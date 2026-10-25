// Shared initial HTML and browser fallback. No dates or user data are embedded.
export function renderShiftRows() {
  return Array.from({ length: 7 }).map((_, i) => `<fieldset class="wh-shift" id="shift-${i}">
    <legend class="wh-sr-only" id="legend-${i}">Day ${i + 1} shift</legend>
    <div class="wh-day"><span id="day-${i}">Day ${i + 1}</span><small id="date-${i}">—</small></div>
    <label><span class="wh-control-label">Start</span><input type="time" step="60" id="start-${i}" data-row="${i}" data-key="start" aria-label="Day ${i + 1} start time" aria-describedby="error-${i}"></label>
    <div class="wh-end-field"><label><span class="wh-control-label">End</span><input type="time" step="60" id="end-${i}" data-row="${i}" data-key="end" aria-label="Day ${i + 1} end time" aria-describedby="error-${i} next-label-${i}"></label><label class="wh-next-day" id="next-wrap-${i}"><input type="checkbox" id="next-${i}" data-row="${i}" data-key="nextDay" aria-label="Day ${i + 1} ends next day"><span id="next-label-${i}">Next day</span></label></div>
    <label><span class="wh-control-label">Unpaid break</span><span class="wh-break-wrap"><input type="number" min="0" max="1440" step="1" inputmode="numeric" placeholder="0" id="break-${i}" data-row="${i}" data-key="breakMinutes" aria-label="Day ${i + 1} unpaid break minutes" aria-describedby="error-${i}"><span>min</span></span></label>
    <div class="wh-row-total"><span id="paid-${i}">—</span><small id="ot-${i}"></small></div><p class="wh-row-error" id="error-${i}" hidden></p>
  </fieldset>`).join('')
}
