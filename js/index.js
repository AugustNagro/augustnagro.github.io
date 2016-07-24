(function() {
    var gifLoadTimeMs = 4.19 * 1000;
    var container = document.body;

    function init() {
        var animViewDay = localStorage.getItem("animViewDay");
        var currentDate = new Date().getDay();

        var gif = document.getElementById('gif');
        var oldSrc = gif.getAttribute('src');
        gif.src = "";
        gif.src = oldSrc + "?" + (new Date()).getTime();
        container.classList.add('loading');

        if(animViewDay != null && currentDate - animViewDay == 0){
            document.getElementsByClassName("ip-header")[0].style.background = "#fff";
            startLoading(0);
        }else{
            startLoading(gifLoadTimeMs);
        }

        localStorage.setItem("animViewDay", currentDate);
    }

    function startLoading(timeout) {
        setTimeout(function () {
            container.classList.remove('loading');
            container.classList.add('loaded');

            var headerText = document.getElementById('header-text');
            headerText.classList.remove('u-hide');
            
        }, timeout);
    }

    init();
})();