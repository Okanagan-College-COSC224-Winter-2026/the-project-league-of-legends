import "./DateTimePicker.css";

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  includeTime?: boolean;
}

export default function DateTimePicker(props: Props) {
  const inputType = props.includeTime ? "datetime-local" : "date";

  const formatDisplayValue = (value: string) => {
    if (!value) {
      return "No date selected";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return props.includeTime
      ? date.toLocaleString()
      : date.toLocaleDateString();
  };

  return (
    <label className="DateTimePicker">
      <span>{props.label}</span>
      <input
        type={inputType}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        disabled={props.disabled}
      />
      <small>{formatDisplayValue(props.value)}</small>
    </label>
  );
}
