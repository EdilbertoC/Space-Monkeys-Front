/** Browser-side download shared by the existing CSV exports. */
export function downloadCsv(contents: string, filename: string) {
  const url = URL.createObjectURL(new Blob([contents], { type: "text/csv;charset=utf-8;" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
