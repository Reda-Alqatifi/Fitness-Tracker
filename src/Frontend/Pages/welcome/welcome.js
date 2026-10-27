import "../../main.js";

function getById(id) {
    return document.getElementById(id);
}
function openPage(destination , target) {
    if (destination.trim() === "")
        return;

    if (target === "_blank")
        window.open(destination, "_blank");
    else
        window.location.href = destination;
    
}

const login = getById("login");
const getStarted = getById("get-started");

login.addEventListener("click" , function() {
    openPage(this.dataset.destination , this.dataset.target);
});
getStarted.addEventListener("click" , function() {
    openPage(this.dataset.destination , this.dataset.target);
});
