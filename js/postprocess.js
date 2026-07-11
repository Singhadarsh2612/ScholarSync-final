/**
 * Post-process a bot message div: detect ui_materials, ui_assignments,
 * ui_interview_confirm JSON blocks and render them as rich cards.
 * 
 * @param {HTMLElement} div - the bot message div
 * @param {string} rawText - the raw markdown text (before marked.parse)
 */
export function postProcessBotDiv(div, rawText) {

    const matRegex = /```ui_materials\s+([\s\S]*?)```/;
    const matchMat = rawText.match(matRegex);
    if (matchMat) {
        try {
            let materials = JSON.parse(matchMat[1].trim());
            let cardsHtml = '<div class="chat-native-list">';
            materials.forEach(m => {
                let subject = m.subject || "Course Material";
                let title = m.title || "Untitled";
                let desc = m.description || "";
                let link = m.link || m.materialLink || "#";
                cardsHtml += `
                <div class="cn-card-horiz">
                  <div class="cnc-right">
                    <div class="cnc-top">
                      <span class="cnc-subject">
                        <svg width="10" height="10" fill="none" viewBox="0 0 24 24" style="margin-right:2px"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                        ${subject}
                      </span>
                    </div>
                    <div class="cnc-title" title="${title}">${title}</div>
                    ${desc ? `<div class="cnc-desc">${desc}</div>` : ""}
                    <div class="cnc-footer">
                      <a href="${link}" class="cnc-btn" target="_blank">
                        Open Material
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                      </a>
                    </div>
                  </div>
                </div>`;
            });
            cardsHtml += '</div>';
            let cleanTxt = rawText.replace(matRegex, "").trim();
            let buttonsHtml = `
            <div style="margin-top:14px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 12px;">
              <p style="font-size: 13.5px; margin-bottom: 10px; color: #d0e8ff;">Do you want to open your materials dashboard?</p>
              <div style="display:flex; gap: 8px;">
                <button class="cnc-btn" style="padding: 6px 16px; border:none; color: var(--electric);" onclick="if(window.parent && window.parent.openMaterials){window.parent.openMaterials()}else{window.location.href='material_view.html'}">Yes, open dashboard ↗</button>
                <button style="padding: 6px 16px; background:transparent; border:1px solid rgba(255,255,255,0.2); color:#a0b8d0; border-radius: 6px; cursor: pointer; transition: all 0.2s;" onclick="this.parentElement.parentElement.style.opacity=0.5; this.disabled=true;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">No, thanks</button>
              </div>
            </div>`;
            div.innerHTML = cardsHtml + (cleanTxt ? `<div style='margin-top:12px; line-height:1.5; font-size:14px;'>${marked.parse(cleanTxt)}</div>` : '') + buttonsHtml;
            return true;
        } catch(e) { console.error("Failed to parse materials JSON", e); }
    }

    const asgRegex = /```ui_assignments\s+([\s\S]*?)```/;
    const matchAsg = rawText.match(asgRegex);
    if (matchAsg) {
        try {
            let assignments = JSON.parse(matchAsg[1].trim());
            let cardsHtml = '<div class="chat-native-list">';
            assignments.forEach(a => {
                let subject = a.subject || "Assignment";
                let title = a.title || "Untitled";
                let desc = a.description || "";
                let doc = a.assignmentDoc || a.link || "#";
                let deadlineStr = a.deadline ? `Due: ${new Date(a.deadline).toLocaleDateString()}` : "No deadline";
                let isLinkValid = doc !== "#";
                let targetAttr = isLinkValid ? 'target="_blank"' : '';
                let hrefAttr = isLinkValid ? doc : 'assignment_solver.html';
                cardsHtml += `
                <div class="cn-card-horiz cn-asg">
                  <div class="cnc-right">
                    <div class="cnc-top">
                      <span class="cnc-subject">
                        <svg width="10" height="10" fill="none" viewBox="0 0 24 24" style="margin-right:2px"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
                        ${subject}
                      </span>
                      <span class="cnc-deadline">${deadlineStr}</span>
                    </div>
                    <div class="cnc-title" title="${title}">${title}</div>
                    ${desc ? `<div class="cnc-desc">${desc}</div>` : ""}
                    <div class="cnc-footer">
                      <a href="${hrefAttr}" class="cnc-btn cnc-btn-asg" ${targetAttr}>
                        View Assignment
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                      </a>
                    </div>
                  </div>
                </div>`;
            });
            cardsHtml += '</div>';
            let cleanTxt = rawText.replace(asgRegex, "").trim();
            let buttonsHtml = `
            <div style="margin-top:14px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 12px;">
              <p style="font-size: 13.5px; margin-bottom: 10px; color: #d0e8ff;">Do you want to know about your assignment in detail?</p>
              <div style="display:flex; gap: 8px;">
                <button class="cnc-btn cnc-btn-asg" style="padding: 6px 16px; border:none;" onclick="if(window.parent && window.parent.openAssignmentSolver){window.parent.openAssignmentSolver()}else{window.location.href='assignment_solver.html'}">Yes, open solver ↗</button>
                <button style="padding: 6px 16px; background:transparent; border:1px solid rgba(255,255,255,0.2); color:#a0b8d0; border-radius: 6px; cursor: pointer; transition: all 0.2s;" onclick="this.parentElement.parentElement.style.opacity=0.5; this.disabled=true;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">No, thanks</button>
              </div>
            </div>`;
            div.innerHTML = cardsHtml + (cleanTxt ? `<div style='margin-top:12px; line-height:1.5; font-size:14px;'>${marked.parse(cleanTxt)}</div>` : '') + buttonsHtml;
            return true;
        } catch(e) { console.error("Failed to parse assignments JSON", e); }
    }

    const ivRegex = /```ui_interview_confirm\s+([\s\S]*?)```/;
    const matchIv = rawText.match(ivRegex);
    if (matchIv) {
        try {
            let iv = JSON.parse(matchIv[1].trim());
            let topic    = (iv.topic || "interview").replace(/_/g, " ");
            let topicCap = topic.charAt(0).toUpperCase() + topic.slice(1);
            let url      = iv.url  || "#";
            let score    = iv.score    !== undefined ? iv.score    : "?";
            let attempts = iv.attempts !== undefined ? iv.attempts : "?";
            let scoreColor = score >= 70 ? "#4ade80" : score >= 40 ? "#facc15" : "#f87171";
            let cleanTxt = rawText.replace(ivRegex, "").trim();
            let cardHtml = `
            <div class="iv-confirm-card" style="
                background: linear-gradient(135deg, rgba(99,102,241,0.15), rgba(168,85,247,0.10));
                border: 1px solid rgba(139,92,246,0.4);
                border-radius: 14px; padding: 18px 20px; margin-top: 10px; font-family: inherit;">
              <div style="display:flex; align-items:center; gap: 10px; margin-bottom: 12px;">
                <span style="font-size:22px;">🎯</span>
                <div>
                  <div style="font-size:15px; font-weight:700; color:#e2d9ff;">${topicCap} Interview</div>
                  <div style="font-size:12px; color:#a78bfa; margin-top:2px;">Ready to start your practice session</div>
                </div>
              </div>
              <div style="display:flex; gap:16px; margin-bottom:16px;">
                <div style="background:rgba(255,255,255,0.05); border-radius:8px; padding:8px 14px; flex:1; text-align:center;">
                  <div style="font-size:11px; color:#94a3b8; margin-bottom:2px;">SCORE</div>
                  <div style="font-size:18px; font-weight:700; color:${scoreColor};">${score}<span style="font-size:11px; color:#94a3b8;">/100</span></div>
                </div>
                <div style="background:rgba(255,255,255,0.05); border-radius:8px; padding:8px 14px; flex:1; text-align:center;">
                  <div style="font-size:11px; color:#94a3b8; margin-bottom:2px;">ATTEMPTS</div>
                  <div style="font-size:18px; font-weight:700; color:#c4b5fd;">${attempts}</div>
                </div>
              </div>
              <p style="font-size:13.5px; color:#d0e8ff; margin-bottom:12px;">
                Do you want to start the <strong>${topicCap}</strong> interview now?
              </p>
              <div style="display:flex; gap:10px;">
                <button onclick="window.open('${url}', '_blank'); this.parentElement.parentElement.style.opacity='0.6'; this.disabled=true;"
                  style="flex:1; padding:9px 0; background:linear-gradient(90deg,#7c3aed,#4f46e5);
                    border:none; border-radius:8px; color:#fff; font-size:14px; font-weight:600;
                    cursor:pointer; transition:opacity 0.2s;"
                  onmouseover="this.style.opacity='0.88'" onmouseout="this.style.opacity='1'">
                  Yes, Start Interview ↗
                </button>
                <button onclick="this.parentElement.parentElement.style.opacity='0.4'; this.disabled=true; this.previousElementSibling.disabled=true;"
                  style="padding:9px 18px; background:transparent;
                    border:1px solid rgba(255,255,255,0.2); color:#94a3b8;
                    border-radius:8px; cursor:pointer; font-size:13px; transition:all 0.2s;"
                  onmouseover="this.style.background='rgba(255,255,255,0.06)'" onmouseout="this.style.background='transparent'">
                  No, thanks
                </button>
              </div>
            </div>`;
            div.innerHTML = (cleanTxt ? `<div style='line-height:1.6; font-size:14px; margin-bottom:8px;'>${marked.parse(cleanTxt)}</div>` : '') + cardHtml;
            return true;
        } catch(e) { console.error("Failed to parse ui_interview_confirm JSON", e); }
    }

    return false;
}
