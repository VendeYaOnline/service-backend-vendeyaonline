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
  date: string;
  client: string;
}
