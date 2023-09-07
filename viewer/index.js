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

        return { events, checkpoints: [0, ...checkpoints, array.length] };
    };

    const getPageMap = function (events) {
        const pages = new Set();
        for (let event of events) {
            if (event.type === Event.Allocation) {
                const page = event.pointer >> 12n;
                pages.add(page);
            }
        }

        return new Map(Object.entries(Array.from(pages).sort()).map(x => x.reverse()));
    };

    const buffer = await load("heapmap.log");
    const { events, checkpoints } = parse(buffer);
    const pageMap = getPageMap(events);
    const nPages = pageMap.size;

    let state;

    const computeState = function (step) {
        console.assert(step >= 0 && step < events.length, "Invalid step.");

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
                live.delete(event.pointer);
            } else {
                console.error("Invalid event type.");
            }
        }

        const pages = new BigUint64Array(nPages).fill(0n);
        for (let [pointer, size] of live) {
            const page = pointer >> 12n;
            console.assert(pageMap.has(page), "Invalid page.");
            pages[pageMap.get(page)] += size;
        }

        state = pages;
    };

    const render = function () {
        const windowWidth = window.innerWidth - 50;
        const windowHeight = window.innerHeight - 50;
        const squaresPerRow = Math.ceil(Math.sqrt(nPages));
        const nRows = Math.ceil(nPages / squaresPerRow);
        const squareSize = Math.min(windowWidth / squaresPerRow, windowHeight / nRows);

        canvas.width = squaresPerRow * squareSize;
        canvas.height = nRows * squareSize;

        const padding = 10;

        for (let i = 0; i < nRows; ++i) {
            for (let j = 0; j < squaresPerRow; ++j) {
                if (i * squaresPerRow + j >= nPages) {
                    break;
                }

                const x = j * squareSize + padding / 2;
                const y = i * squareSize + padding / 2;
                const width = squareSize - padding;
                const height = squareSize - padding;

                const page = i * squaresPerRow + j;
                const size = state[page];
                context.fillStyle = "green";
                context.fillRect(x, y, width, (squareSize - padding) * (Number(size) / 4096));

                context.fillStyle = "black";
                context.strokeRect(x, y, width, height);
            }
        }
    };

    document.getElementById("step").value = 0;
    document.getElementById("step").min = 0;
    document.getElementById("step").max = events.length;
    document.getElementById("step").addEventListener("change", e => {
        computeState(e.target.value);
        render();
    }, false);

    window.addEventListener("resize", render, false);

    computeState(0);
    render();
})();
