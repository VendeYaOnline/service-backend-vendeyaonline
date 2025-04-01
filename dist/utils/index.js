"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSubscriptionType = exports.formatDate = void 0;
const formatDate = (dateString) => {
    const date = new Date(dateString);
    const day = String(date.getUTCDate()).padStart(2, "0");
    const month = String(date.getUTCMonth() + 1).padStart(2, "0"); // +1 porque los meses son 0-based
    const year = date.getUTCFullYear();
    return `${day}/${month}/${year}`;
};
exports.formatDate = formatDate;
const getSubscriptionType = (reason) => {
    const cleanedType = reason.replace("Plan ", "").trim();
    const validTypes = ["Emprendedor", "Crecimiento", "Corporativo"];
    if (!validTypes.includes(cleanedType)) {
        throw new Error(`Tipo de suscripción inválido: ${cleanedType}`);
    }
    return cleanedType;
};
exports.getSubscriptionType = getSubscriptionType;
