const max = (...args) => args.reduce((m, e) => e > m ? e : m);
const min = (...args) => args.reduce((m, e) => e < m ? e : m);

(async function () {
    // This should match with the Event enum class in C++.
    const Event = {
        Allocation: 1n,
        Free: 2n,
        Checkpoint: 3n,
    };

    const canvas = document.getElementById("canvas");
    const context = canvas.getContext("2d");

    const load = async function (filename) {
        const response = await fetch(filename);
        return await response.arrayBuffer();
    };

    const parse = function (buffer) {
        const array = new BigUint64Array(buffer);
        console.assert(array.length % 3 === 0, "Invalid buffer length.");

        const checkpoints = [];
        const events = [];
        for (let i = 0; i < array.length; i += 3) {
            const type = array[i];
            const size = array[i + 1];
            const pointer = array[i + 2];

            if (type === Event.Allocation) {
                events.push({ "type": type, "size": size, "pointer": pointer });
            } else if (type === Event.Free) {
                events.push({ "type": type, "pointer": pointer });
            } else if (type === Event.Checkpoint) {
                checkpoints.push(i - checkpoints.length);
            } else {
                console.error("Invalid event type.");
            }
        }

        return { events, checkpoints: [0, ...checkpoints, events.length] };
    };

    const getPageMap = function (events) {
        const pages = new Set();
        for (let event of events) {
            if (event.type === Event.Allocation) {
                const page = event.pointer >> 12n;
                for (let i = 0n; 4096n * i < event.size; ++i) {
                    pages.add(page + i);
                }
            }
        }

        const sortedPages = Array.from(pages).sort();
        const pageMap = new Map();
        for (let i = 0; i < sortedPages.length; ++i) {
            pageMap.set(sortedPages[i], i);
        }
        return pageMap;
    };

    const buffer = await load("heapmap.log");
    const { events, checkpoints } = parse(buffer);
    const pageMap = getPageMap(events);
    const reversePageMap = new Map(Array.from(pageMap).map(x => x.reverse()));
    const nPages = pageMap.size;

    const getPagesTouched = function (step) {
        console.assert(step >= 0 && step <= events.length, "Invalid step " + step + ".");
        if (step === events.length) {
            return new Set();
        }

        const touched = new Set();
        const event = events[step];
        if (event.type === Event.Allocation) {
            const page = event.pointer >> 12n;
            for (let i = 0n; 4096n * i < event.size; ++i) {
                touched.add(page + i);
            }
        } else if (event.type === Event.Free) {
            const page = event.pointer >> 12n;
            touched.add(page);
        } else {
            console.error("Invalid event type.");
        }

        return touched;
    };

    const computeState = function (step) {
        console.assert(step >= 0 && step <= events.length, "Invalid step " + step + ".");

        if (step == events.length) {
            document.getElementById("next-step").textContent = "N/A";
        } else if (events[step].type === Event.Allocation) {
            document.getElementById("next-step").textContent = "malloc(" + events[step].size + ")";
        } else if (events[step].type === Event.Free) {
            document.getElementById("next-step").textContent = "free()";
        } else {
            console.error("Invalid event type.");
        }

        const live = new Map();
        for (let i = 0; i < step; ++i) {
            const event = events[i];
            if (event.type === Event.Allocation) {
                if (live.has(event.pointer)) {
                    console.warn("Missing free detected.");
                }
                live.set(event.pointer, event.size);
            } else if (event.type === Event.Free) {
                if (!live.has(event.pointer)) {
                    console.warn("Unallocated free detected.");
                }
                live.delete(event.pointer);
            } else {
                console.error("Invalid event type.");
            }
        }

        const pages = new BigUint64Array(nPages).fill(0n);
        for (let [pointer, size] of live) {
            while (size > 0n) {
                const page = pointer >> 12n;
                console.assert(pageMap.has(page), "Invalid page.");
                const offset = pointer - (page << 12n);
                const allocation = min(size, 4096n - offset);
                pages[pageMap.get(page)] += allocation;
                size -= allocation;
                pointer += allocation;
            }
        }

        return { step, live, pages };
    };

    const render = function (state) {
        const windowWidth = window.innerWidth - 50;
        const windowHeight = window.innerHeight - 50;
        const squaresPerRow = Math.ceil(Math.sqrt(nPages));
        const nRows = Math.ceil(nPages / squaresPerRow);
        const squareSize = Math.min(windowWidth / squaresPerRow, windowHeight / nRows);

        canvas.width = squaresPerRow * squareSize;
        canvas.height = nRows * squareSize;

        const padding = 10;

        const touchedThisStep = getPagesTouched(state.step);
        const touchedLastStep = state.step > 0 ? getPagesTouched(state.step - 1) : new Set();

        for (let i = 0; i < nRows; ++i) {
            for (let j = 0; j < squaresPerRow; ++j) {
                if (i * squaresPerRow + j >= nPages) {
                    break;
                }

                const page = i * squaresPerRow + j;

                const x = j * squareSize;
                const y = i * squareSize;
                const w = squareSize;
                const h = squareSize;
                const padx = x + padding / 2;
                const pady = y + padding / 2;
                const padw = w - padding;
                const padh = h - padding;
                const barHeight = (padh - padding) * (Number(state.pages[page]) / 4096);

                if (touchedLastStep.has(reversePageMap.get(page))) {
                    context.fillStyle = "orange";
                    context.fillRect(x, y, w, h);
                }

                if (touchedThisStep.has(reversePageMap.get(page))) {
                    context.fillStyle = "red";
                    context.fillRect(x, y, w, h);
                }

                context.fillStyle = "white";
                context.fillRect(padx, pady, padw, padh);

                context.fillStyle = "green";
                context.fillRect(padx, pady + padh - barHeight, padw, barHeight);

                context.fillStyle = "black";
                context.strokeRect(padx, pady, padw, padh);
            }
        }
    };

    document.getElementById("step").value = 0;
    document.getElementById("step").min = 0;
    document.getElementById("step").max = events.length;
    document.getElementById("step").addEventListener("change", e => render(computeState(e.target.value)), false);

    document.getElementById("back-checkpoint").addEventListener("click", e => {
        const current = Number(document.getElementById("step").value);
        if (current === 0) {
            return;
        }

        const checkpoint = checkpoints.filter(x => x < current).pop();
        document.getElementById("step").value = checkpoint;
        render(computeState(checkpoint));
    });

    document.getElementById("back-5%").addEventListener("click", e => {
        const current = Number(document.getElementById("step").value);
        if (current === 0) {
            return;
        }

        const shift = Math.ceil(events.length / 20);
        const next = Math.max(current - shift, 0);
        document.getElementById("step").value = next;
        render(computeState(next));
    });

    document.getElementById("back-1").addEventListener("click", e => {
        const current = Number(document.getElementById("step").value);
        if (current > 0) {
            document.getElementById("step").value = current - 1;
            render(computeState(current - 1));
        }
    });

    document.getElementById("forward-1").addEventListener("click", e => {
        const current = Number(document.getElementById("step").value);
        if (current < events.length) {
            document.getElementById("step").value = current + 1;
            render(computeState(current + 1));
        }
    });

    document.getElementById("forward-5%").addEventListener("click", e => {
        const current = Number(document.getElementById("step").value);
        if (current === events.length) {
            return;
        }

        const shift = Math.ceil(events.length / 20);
        const next = Math.min(current + shift, events.length);
        document.getElementById("step").value = next;
        render(computeState(next));
    });

    document.getElementById("forward-checkpoint").addEventListener("click", e => {
        const current = Number(document.getElementById("step").value);
        if (current === events.length) {
            return;
        }

        const checkpoint = checkpoints.filter(x => x > current).shift();
        document.getElementById("step").value = checkpoint;
        render(computeState(checkpoint));
    });

    window.addEventListener("resize", e => render(computeState(Number(document.getElementById("step").value))), false);

    render(computeState(0));
})();
