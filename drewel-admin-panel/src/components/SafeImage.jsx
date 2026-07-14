/* eslint-disable react/prop-types */
import { useEffect, useState } from "react";
import { normalizeAssetUrl } from "../utils/media";

const getInitials = (value) => {
  const words = `${value || ""}`.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  return words.slice(0, 2).map((word) => word[0]).join("").toUpperCase();
};

const SafeImage = ({
  src,
  alt = "",
  className = "",
  style,
  fallback = "image",
  fallbackLabel,
  onError,
  ...imageProps
}) => {
  const [failed, setFailed] = useState(false);
  const normalizedSource = normalizeAssetUrl(src);
  const validSource = normalizedSource !== "";

  useEffect(() => setFailed(false), [src]);

  if (!validSource || failed) {
    const isAvatar = fallback === "avatar";
    return (
      <div
        className={`${className} d-flex align-items-center justify-content-center`}
        style={{
          backgroundColor: isAvatar ? "#e7eef8" : "#f4f4f4",
          color: isAvatar ? "#00489d" : "#6c757d",
          fontWeight: isAvatar ? 700 : 500,
          textAlign: "center",
          ...style,
        }}
        role="img"
        aria-label={alt ? `${alt} unavailable` : "Image unavailable"}
      >
        {isAvatar ? (
          getInitials(fallbackLabel || alt)
        ) : (
          <span className="d-flex flex-column align-items-center justify-content-center p-2">
            <span
              aria-hidden="true"
              style={{ width: 28, height: 22, border: "2px solid currentColor", borderRadius: 3, marginBottom: 6 }}
            />
            <span>{fallbackLabel || "Image unavailable"}</span>
          </span>
        )}
      </div>
    );
  }

  return (
    <img
      {...imageProps}
      src={normalizedSource}
      alt={alt}
      className={className}
      style={style}
      onError={(event) => {
        setFailed(true);
        onError?.(event);
      }}
    />
  );
};

export default SafeImage;
