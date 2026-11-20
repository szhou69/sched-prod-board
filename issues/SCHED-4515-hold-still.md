---
id: SCHED-4515
title: List holds still; "N new" bar brings new incidents in
status: done
plan: R1 (changed), R7 (new)
---

Step-1 recording (00:42): a new incident landed at the top while on-call was aiming at INC-1131's Ack; the rows
moved and the click acked INC-2318. Product's decision: "The list holds still while it is on screen; a "N new"
bar brings new incidents in on click. Ack stays on the row."

- A refresh never moves, re-orders or removes a row on screen.
- New incidents wait behind `data-testid="new-bar"` ("N new incidents · show"), in a fixed slot above the list.
- Clicking the bar puts them at the top, newest first.
- Ack stays one click on the row.
