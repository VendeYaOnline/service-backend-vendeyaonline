export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  // Formatear en la zona horaria de Colombia (UTC-5) para evitar el desfase de
  // un día: con getUTCDate() un pago hecho de noche caía al día siguiente.
  const parts = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("day")}/${get("month")}/${get("year")}`;
};

export const getSubscriptionType = (reason: string): string => {
  const cleanedType = reason.replace("Plan ", "").trim();
  const validTypes = ["Emprendedor", "Crecimiento", "Corporativo"];
  if (!validTypes.includes(cleanedType)) {
    throw new Error(`Tipo de suscripción inválido: ${cleanedType}`);
  }
  return cleanedType;
};
