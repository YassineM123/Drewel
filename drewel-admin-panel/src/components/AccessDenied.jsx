import PropTypes from "prop-types";
import { ShieldAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function AccessDenied({
  title = "Access denied",
  description = "You don't have permission to view this page. Contact an Owner if you believe this is a mistake.",
}) {
  const navigate = useNavigate();
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-sm text-center">
        <div className="w-12 h-12 rounded-full bg-red-50 border border-red-200 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert size={20} className="text-[#BE1B2C]" />
        </div>
        <h1 className="text-lg font-bold text-slate-900 mb-1.5">{title}</h1>
        <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
        <button
          onClick={() => navigate("/dashboard")}
          className="mt-6 h-9 px-4 rounded-[10px] bg-[#BE1B2C] hover:bg-[#A31725] text-white text-sm font-semibold transition-colors"
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}

AccessDenied.propTypes = {
  title: PropTypes.string,
  description: PropTypes.string,
};
