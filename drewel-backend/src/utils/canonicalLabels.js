const tokenPattern = /[a-z0-9]+/g;

export const canonicalLabelKey = (value) =>
  String(value ?? "")
    .toLowerCase()
    .match(tokenPattern)
    ?.join("_") ?? "";

export const flexibleExactRegex = (value) => {
  const tokens = String(value ?? "").toLowerCase().match(tokenPattern) || [];
  if (!tokens.length) return null;
  const escaped = tokens.map((token) =>
    token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  );
  return new RegExp(`^${escaped.join("[\\s+_-]*")}$`, "i");
};

