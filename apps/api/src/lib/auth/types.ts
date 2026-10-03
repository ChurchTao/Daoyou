export type AuthUser = {
  id: string;
  email: string;
  name: string;
};

export type ActiveCultivatorRef = {
  userId: string;
  cultivatorId: string;
  status: 'active';
};
