# packages/form-definitions

The shared form definition: which fields each template (General, Surgery, Respiratory, …) has, their types, answer options and the code behind each answer option.

Used by the web app (rendering and validation) and by the backend (storage and export). This is the first contract the team agrees on.

Definitions are **versioned**. Drafts written offline may be sent after an app update, so every saved case records its form version, and the backend accepts older versions.

**Owner:** Area 1 (clinical content). The codes are added together with area 3.
