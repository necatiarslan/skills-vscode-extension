"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSkillEmoji = getSkillEmoji;
/**
 * Get a consistent emoji for a skill based on its ID.
 * Same skill ID always returns the same emoji (deterministic).
 */
function getSkillEmoji(skillId) {
    const emojis = [
        // Tech & Tools
        '🚀', '💻', '⚡', '🔧', '🛠️', '⚙️', '🔌', '💾', '📡', '🖥️',
        // Concepts
        '💡', '🧠', '🔍', '📊', '📈', '📉', '🎯', '🎨', '🖌️', '✨',
        // Work & Productivity
        '📝', '📚', '📋', '📄', '📑', '🗂️', '📂', '🗃️', '⏰', '⏱️',
        // Nature & Elements
        '🌟', '⭐', '✨', '🔥', '💧', '🌊', '🌈', '🌳', '🌸', '🌺',
        // Objects & Items
        '🎪', '🎭', '🎬', '🎸', '🎺', '🎲', '🧩', '🎯', '🏆', '🥇',
        // Communication
        '💬', '💭', '📢', '📣', '📞', '📧', '✉️', '💌', '📮', '📬',
        // Status & Indicators
        '✅', '❌', '⚠️', '❓', '❗', '🔔', '🔕', '📍', '🎯', '🔐',
        // Fun & Playful
        '🎮', '🕹️', '🎲', '🃏', '🎰', '🎪', '🎢', '🎡', '🎠', '🎟️',
        // Time & Calendar
        '📅', '🗓️', '⏳', '⌛', '🕐', '🕑', '🕒', '🕓', '🕔', '🕕',
        // Additional variety
        '🌐', '🌍', '🌎', '🌏', '🚢', '🚁', '✈️', '🚂', '🚗', '🚙'
    ];
    // Simple hash function: convert skill ID to a number
    let hash = 0;
    for (let i = 0; i < skillId.length; i++) {
        const char = skillId.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    // Return emoji at index based on hash
    return emojis[Math.abs(hash) % emojis.length];
}
//# sourceMappingURL=SkillEmoji.js.map