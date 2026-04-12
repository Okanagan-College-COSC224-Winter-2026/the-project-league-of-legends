import { importStudentsForCourse } from "./api";

export const importCSV = (
  id: string | number,
  options?: {
    onSuccess?: () => Promise<void> | void;
    onError?: (message: string) => void;
  },
) => {
  const input = document.createElement("input");
  input.setAttribute("type", "file");
  input.setAttribute("accept", ".csv,text/csv");

  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    const reader = new FileReader();

    reader.onload = async () => {
      const text = reader.result?.toString();

      if (!text) {
        const message = "Please select a CSV file to upload";
        options?.onError?.(message);
        alert(message);
        return;
      }

      try {
        await importStudentsForCourse(Number(id), text);
        await options?.onSuccess?.();
        alert("Students enrolled successfully.");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : `Error: ${String(error)}`;
        options?.onError?.(message);
        alert(message);
      }
    };

    if (!file) {
      const message = "Please select a file to upload";
      options?.onError?.(message);
      alert(message);
      return;
    }

    reader.readAsText(file);
  });

  input.click();
};
