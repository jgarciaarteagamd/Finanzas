/* Adaptador de la capacidad `downloads` de los artefactos: guarda
   un archivo de texto usando la descarga normal del navegador. */
export function crearDownloads() {
  return {
    save: async ({ filename, data }) => {
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename || 'datos.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    },
  };
}
