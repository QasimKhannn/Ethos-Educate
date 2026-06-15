// cowork — dedicated layout for the Cowork section: persistent rail + outlet.
// Sits outside the regular chat shell so Cowork is its own self-contained space.
import { Outlet } from 'react-router-dom';
import { useAuthContext } from '~/hooks';
import CoworkSidebar from './CoworkSidebar';

export default function CoworkLayout() {
  const { isAuthenticated } = useAuthContext();

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-surface-primary">
      <CoworkSidebar />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
