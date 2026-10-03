export type FriendRelationship = 'friend' | 'none';

export interface FriendCultivatorSummary {
  id: string;
  name: string;
  title: string | null;
  realm: string;
  realmStage: string;
  status: string;
}

export interface FriendTargetResponse {
  target: FriendCultivatorSummary;
  relationship: FriendRelationship;
  isFriend: boolean;
}

export interface FriendSearchResult extends FriendCultivatorSummary {
  relationship: FriendRelationship;
  isFriend: boolean;
}

export interface FriendSearchResponse {
  results: FriendSearchResult[];
}
