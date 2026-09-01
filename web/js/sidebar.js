import { deleteThread } from "./deleteThread.js";

export function initSidebarSync(){

    const sel = document.getElementById("thread-list");
    const historyList = document.getElementById("history-list");

    function syncHistory(){

        const opts = Array.from(sel.options).filter(o => o.value);

        if(!opts.length){
            historyList.innerHTML =
                '<div class="history-empty">No conversations yet</div>';
            return;
        }

        historyList.innerHTML = "";

        opts.forEach(opt => {

            const item = document.createElement("div");

            item.className =
                "history-item" +
                (sel.value === opt.value ? " active" : "");

            item.innerHTML = `
                <span>${opt.text}</span>
                <button class="delete-btn"
                        data-thread="${opt.value}">
                        🗑
                </button>
            `;

            item.onclick = (e) => {

                if(e.target.classList.contains("delete-btn"))
                    return;

                sel.value = opt.value;

                sel.dispatchEvent(new Event("change"));

                document
                    .querySelectorAll(".history-item")
                    .forEach(i => i.classList.remove("active"));

                item.classList.add("active");
            };

            const deleteBtn = item.querySelector(".delete-btn");

            deleteBtn.onclick = async (e) => {

                e.stopPropagation();

                const threadId = deleteBtn.dataset.thread;

                await deleteThread(threadId);

            };

            historyList.appendChild(item);

        });

    }

    new MutationObserver(syncHistory)
        .observe(sel, { childList: true });

}
