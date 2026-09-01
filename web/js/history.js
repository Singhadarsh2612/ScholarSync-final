import { API_BASE, getThreadID, setThreadID } from "./config.js";
import { addMessage } from "./ui.js";


export async function loadHistory(){

    const thread_id = getThreadID();

    if(!thread_id) return;

    const response = await fetch(`${API_BASE}/history`, {

        method: "POST",

        headers: {
            "Content-Type": "application/json"
        },

        body: JSON.stringify({
            thread_id: thread_id
        })

    });

    const data = await response.json();

    const chatBox = document.getElementById("chat-box");

    chatBox.innerHTML = "";

    data.history.forEach(msg => {

        if(msg.type === "human"){
            addMessage("user", msg.content);
        }

        if(msg.type === "ai"){
            addMessage("bot", msg.content);
        }

    });

}



export async function loadThreads(){

    const response = await fetch(`${API_BASE}/threads`);

    const data = await response.json();

    const dropdown = document.getElementById("thread-list");

    const historyList = document.getElementById("history-list");

    dropdown.innerHTML = "";
    historyList.innerHTML = "";

    const entries = Object.entries(data.threads);

    if(entries.length === 0){

        historyList.innerHTML =
            '<div class="history-empty">No conversations yet</div>';

        return;
    }

    entries.forEach(([id, name]) => {

        const option = document.createElement("option");

        option.value = id;
        option.text = name;

        dropdown.appendChild(option);


        const item = document.createElement("div");

        item.className = "history-item";


        const row = document.createElement("div");

        row.style.display = "flex";
        row.style.justifyContent = "space-between";
        row.style.alignItems = "center";


        const label = document.createElement("span");

        label.textContent = name;

        label.style.cursor = "pointer";

        label.onclick = () => {

            setThreadID(id);

            loadHistory();

        };


        const deleteBtn = document.createElement("button");

        deleteBtn.innerHTML = "🗑";

        deleteBtn.style.background = "transparent";
        deleteBtn.style.border = "none";
        deleteBtn.style.cursor = "pointer";
        deleteBtn.style.color = "#ff6b6b";

        deleteBtn.onclick = (e) => {

            e.stopPropagation();

            deleteThread(id);

        };


        row.appendChild(label);

        row.appendChild(deleteBtn);

        item.appendChild(row);

        historyList.appendChild(item);

    });

}



export async function deleteThread(thread_id){

    if(!thread_id) return;

    const confirmDelete = confirm("Delete this conversation?");

    if(!confirmDelete) return;


    await fetch(`${API_BASE}/thread`, {

        method: "DELETE",

        headers: {
            "Content-Type": "application/json"
        },

        body: JSON.stringify({
            thread_id: thread_id
        })

    });


    if(getThreadID() === thread_id){

        document.getElementById("chat-box").innerHTML = "";

        setThreadID(null);

    }


    await loadThreads();

}



export async function deleteCurrentThread(){

    const thread_id = getThreadID();

    await deleteThread(thread_id);

}
