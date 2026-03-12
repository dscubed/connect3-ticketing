export interface AvatarProfile {
  id: string;
  first_name: string;
  avatar_url: string | null;
}

export interface EventCardDetails {
  id: string;
  name: string | null;
  start: string | null;
  thumbnail: string | null;
  is_online: boolean;
  status: string;
  category: string | null;
  location_name: string | null;
  host: AvatarProfile;
  collaborators: AvatarProfile[] | null;
}
