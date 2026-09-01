import { setThreadID } from "./config.js";
import { loadThreads } from "./history.js";

export function generateThreadID(){
    return "thread_" + crypto.randomUUID();
}

export function newChat(){

    const id = generateThreadID();

    setThreadID(id);

    document.getElementById("chat-box").innerHTML = `
            <div class="chat-welcome" id="chat-welcome" style="display: flex; flex-direction: column; align-items: center; justify-content: flex-start; height: 100%; text-align: center; padding-top: 15vh;">
              <div style="font-family: var(--font-d); font-size: 32px; font-weight: 800; color: #fff; margin-bottom: 12px; letter-spacing: -0.02em;">ScholarSync</div>
              <div style="font-family: var(--font-b); font-size: 18px; color: #fff; opacity: 0.95;">Hello, how can I assist you?</div>
            </div>
    `;

    loadThreads();

}

export function switchThread(){

    const dropdown = document.getElementById("thread-list");

    const selectedThread = dropdown.value;

    if(!selectedThread) return;

    setThreadID(selectedThread);

    import("./history.js").then(module => {
        module.loadHistory();
    });

}
