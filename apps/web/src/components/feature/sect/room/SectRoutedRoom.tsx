import {
  getSectPresentationForContext,
  useSectContextQuery,
} from '@app/components/feature/sect/sectResources';
import { SectManagedRoom, type SectManagedRoomProps } from './SectManagedRoom';
import { useSectRoomRouteSelection } from './useSectRoomRouteSelection';

export type SectRoutedRoomProps = Omit<
  SectManagedRoomProps,
  'room' | 'selection'
>;

export function SectRoutedRoom(props: SectRoutedRoomProps) {
  const context = useSectContextQuery();
  const room = getSectPresentationForContext(context.data).rooms[props.roomKey];
  const selection = useSectRoomRouteSelection(room);
  return <SectManagedRoom {...props} room={room} selection={selection} />;
}
