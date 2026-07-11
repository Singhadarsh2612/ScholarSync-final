import { getThreadID, setThreadID } from "./config.js";
import { generateThreadID, newChat, switchThread } from "./thread.js";
import { sendMessage } from "./chat.js?v=14";
import { loadHistory, loadThreads, deleteCurrentThread } from "./history.js";
import { initSidebarSync } from "./sidebar.js";

document.addEventListener("DOMContentLoaded", async () => {

try {

    if (!getThreadID()) {
        setThreadID(generateThreadID());
    }

    initSidebarSync();

    await loadThreads();

    await loadHistory();

    const messageInput = document.getElementById("message");

    if (messageInput) {

        messageInput.addEventListener("keypress", (event) => {

            if (event.key === "Enter") {
                event.preventDefault();
                sendMessage();
            }

        });

    }

    console.log("App initialized successfully");

} catch (error) {

    console.error("Initialization failed:", error);

}


});

window.sendMessage = sendMessage;
window.newChat = newChat;
window.switchThread = switchThread;
window.deleteCurrentThread = deleteCurrentThread;