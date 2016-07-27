document.addEventListener('DOMContentLoaded', function(){
    var gifLoadTimeMs = 4.19 * 1000;
    var container = document.body;

    function init() {
        var animViewDay = localStorage.getItem("animViewDay");
        var currentDate = new Date().getDay();

        // allows the cached, single-loop gif to replay on page reload
        var gif = document.getElementById('gif');
        var oldSrc = gif.getAttribute('src');
        gif.src = "";
        gif.src = oldSrc + "?" + (new Date()).getTime();

        container.classList.add('loading');

        if(animViewDay != null && currentDate - animViewDay == 0){
            startLoading(0);
        }else{
            document.getElementsByClassName("ip-header")[0].style.background = "#00023D";
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
}, false)