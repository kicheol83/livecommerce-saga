type TextFieldProps = {
  id: string;
  label: string;
  type: "email" | "password" | "text" | "tel";
  inputMode?: "text" | "numeric" | "tel";
  placeholder?: string;
  value: string;
  autoComplete: string;
  hint?: string;
  error?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
};

export function TextField({ id, label, type, value, autoComplete, inputMode, placeholder, hint, error, onChange, onBlur }: TextFieldProps) {
  const describedBy = error !== undefined ? `${id}-error` : hint !== undefined ? `${id}-hint` : undefined;

  return (
    <div>
      <label htmlFor={id} className="text-[14px] font-semibold text-pine">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        inputMode={inputMode}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        aria-invalid={error !== undefined}
        aria-describedby={describedBy}
        className={`mt-1.5 h-12 w-full rounded-[12px] border bg-white px-3.5 text-[16px] text-pine placeholder:text-ash/70 ${
          error !== undefined ? "border-cranberry" : "border-frost-300"
        }`}
      />
      {error !== undefined ? (
        <p id={`${id}-error`} className="mt-1.5 text-[13px] text-cranberry">
          {error}
        </p>
      ) : hint !== undefined ? (
        <p id={`${id}-hint`} className="mt-1.5 text-[13px] text-ash">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
