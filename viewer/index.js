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

        return { events, checkpoints };
    };

    const getNPages = function (events) {
        const pages = new Set();
        for (let event of events) {
            if (event.type === Event.Allocation) {
                const page = event.pointer >> 12n;
                pages.add(page);
            }
        }
        return pages.size;
    }

    const buffer = await load("heapmap.log");
    const { events, checkpoints } = parse(buffer);
    const n = getNPages(events);
    console.log(events);
    console.log(checkpoints);
    console.log(n);

    const render = function () {
        const windowWidth = window.innerWidth - 50;
        const windowHeight = window.innerHeight - 50;
        const squaresPerRow = Math.ceil(Math.sqrt(n));
        const nRows = Math.ceil(n / squaresPerRow);
        const squareSize = Math.min(windowWidth / squaresPerRow, windowHeight / nRows);

        canvas.width = squaresPerRow * squareSize;
        canvas.height = nRows * squareSize;

        const padding = 10;

        for (let i = 0; i < nRows; ++i) {
            for (let j = 0; j < squaresPerRow; ++j) {
                if (i * squaresPerRow + j >= n) {
                    break;
                }

                const x = j * squareSize;
                const y = i * squareSize;
                context.fillStyle = "black";
                context.strokeRect(x + padding / 2, y + padding / 2, squareSize - padding, squareSize - padding);
            }
        }
    };

    window.addEventListener("resize", render, false);
    render();
})();
