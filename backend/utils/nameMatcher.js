const NAME_VARIATIONS = ["shahmir", "shamir", "shameer", "zubair", "shahmeer"];

function mentionsMe(message) {
  const lowerMessage = message.toLowerCase();
  return NAME_VARIATIONS.some((name) => lowerMessage.includes(name));
}

module.exports = { mentionsMe };
