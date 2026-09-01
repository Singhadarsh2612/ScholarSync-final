import { API_BASE, getThreadID } from "./config.js";
import { addMessage, createBotMessage } from "./ui.js";
import { postProcessBotDiv } from "./postprocess.js";

export async function sendMessage(){

    const input = document.getElementById("message");

    const msg = input.value.trim();

    if(msg === "") return;

    addMessage("user", msg);

    input.value = "";

    const botDiv = createBotMessage();

    try{

        const response = await fetch(`${API_BASE}/chat-stream`, {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                message: msg,
                thread_id: getThreadID()
            })

        });

        const reader = response.body.getReader();

        const decoder = new TextDecoder();

        let accumulatedText = "";

        while(true){

            const { done, value } = await reader.read();

            if(done) break;

            accumulatedText += decoder.decode(value);
            botDiv.innerHTML = marked.parse(accumulatedText);

            const chatBox = document.getElementById("chat-box");
            if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;

        }

        let finalTxt = accumulatedText;

        if (finalTxt.includes("[REDIRECT:assignment_solver]")) {
            window.location.href = "assignment_solver.html";
            return;
        }
        if (finalTxt.includes("[REDIRECT:materials]")) {
            window.location.href = "material_view.html";
            return;
        }
        if (finalTxt.includes("[REDIRECT:study_planner]")) {
            window.location.href = "index.html";
            return;
        }

        postProcessBotDiv(botDiv, finalTxt);

    }
    catch(error){

        botDiv.innerText = "Error connecting to server";

        console.error(error);

    }

}
