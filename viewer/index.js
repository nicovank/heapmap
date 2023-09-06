(function () {
    const canvas = document.getElementById('canvas');
    const context = canvas.getContext('2d');

    const render = function () {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        context.fillStyle = '#000';
        context.fillRect(0, 0, canvas.width, canvas.height);

    }

    window.addEventListener('resize', render, false);

    render();
})();