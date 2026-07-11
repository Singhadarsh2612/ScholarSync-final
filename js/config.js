export const API_BASE = "";

export let thread_id = localStorage.getItem("thread_id");

export function setThreadID(id){
    thread_id = id;
    localStorage.setItem("thread_id", id);
}

export function getThreadID(){
    return thread_id;
}
