export interface UserI {
  id: number;
  username: string;
  email: string;
  password: string;
  Subscriptions: [{ dataValues: SuscriptionI }];
  CanceledSubscriptions: [{ dataValues: SuscriptionI }];
  PreapprovaldSubscription: { dataValues: { id: number; client: number } };
  updatedat?: Date;
}

export interface SuscriptionI {
  id?: number;
  price: number;
  type: string;
  quantityProducts: number;
  numberProductsCreated: number;
  subscriptionId: string;
  status: string;
  date: string;
  client: string;
  /** Complementos que se suman a la mensualidad, con su precio (utils/addons.ts). Las antiguas son solo la clave. */
  addons?: (string | { key: string; price: number })[];
}
