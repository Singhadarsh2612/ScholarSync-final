import { API_BASE } from "./config.js";
import { loadThreads } from "./history.js";

export async function deleteThread(threadId) {

    if (!threadId) return;

    const confirmDelete = confirm("Delete this conversation?");

    if (!confirmDelete) return;

    try {

        const response = await fetch(`${API_BASE}/thread`, {

            method: "DELETE",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                thread_id: threadId
            })

        });

        const data = await response.json();

        if (data.success) {

            console.log("Thread deleted:", threadId);

            await loadThreads();

            document.getElementById("chat-box").innerHTML = "";

        }

    }
    catch(err){

        console.error("Delete failed:", err);

    }

}
