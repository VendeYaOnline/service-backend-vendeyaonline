export interface UserI {
  id: number;
  username: string;
  email: string;
  password: string;
  Subscriptions: SuscriptionI[];
  updatedat?: Date;
}

export interface SuscriptionI {
  price: number;
  type: string;
  date: string;
  client: string;
}
