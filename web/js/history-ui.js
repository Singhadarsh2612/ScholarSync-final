const sel = document.getElementById("thread-list");
const historyList = document.getElementById("history-list");

export function syncHistory(){

    const opts = Array.from(sel.options).filter(o => o.value);

    if(!opts.length){
        historyList.innerHTML =
            '<div class="history-empty">No conversations yet</div>';
        return;
    }

    historyList.innerHTML = "";

    opts.forEach(opt => {

        const row = document.createElement("div");

        row.className =
            "history-item-row" +
            (sel.value === opt.value ? " active" : "");

        const item = document.createElement("div");

        item.className = "history-item";

        item.textContent = opt.text;

        item.onclick = () => {

            sel.value = opt.value;

            sel.dispatchEvent(new Event("change"));

            syncHistory();
        };


        const del = document.createElement("button");

        del.className = "delete-btn";

        del.innerHTML = "🗑";

        del.onclick = async (e) => {

            e.stopPropagation();

            sel.value = opt.value;

            await window.deleteCurrentThread();
        };


        row.appendChild(item);

        row.appendChild(del);

        historyList.appendChild(row);
    });

}


export function initHistoryObserver(){

    const observer = new MutationObserver(syncHistory);

    observer.observe(sel, {
        childList: true
    });

}
