export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0"); // +1 porque los meses son 0-based
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
};

export const getSubscriptionType = (reason: string): string => {
  const cleanedType = reason.replace("Plan ", "").trim();
  const validTypes = ["Emprendedor", "Crecimiento", "Corporativo"];
  if (!validTypes.includes(cleanedType)) {
    throw new Error(`Tipo de suscripción inválido: ${cleanedType}`);
  }
  return cleanedType;
};
