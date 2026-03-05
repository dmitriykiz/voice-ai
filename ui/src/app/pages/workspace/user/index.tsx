import { useEffect, useState, useCallback } from 'react';
import { Helmet } from '@/app/components/helmet';
import { InviteUserDialog } from '@/app/components/base/modal/invite-user-modal';
import { User } from '@rapidaai/react';
import { useCurrentCredential } from '@/hooks/use-credential';
import toast from 'react-hot-toast/headless';
import { SearchIconInput } from '@/app/components/form/input/IconInput';
import { TablePagination } from '@/app/components/base/tables/table-pagination';
import { useRapidaStore } from '@/hooks';
import { BluredWrapper } from '@/app/components/wrapper/blured-wrapper';
import { useUserPageStore } from '@/hooks';
import { SingleUser } from '@/app/pages/workspace/user/single-user';
import { IButton } from '@/app/components/form/button';
import { Plus, RotateCw } from 'lucide-react';
import { PaginationButtonBlock } from '@/app/components/blocks/pagination-button-block';
import { PageHeaderBlock } from '@/app/components/blocks/page-header-block';
import { PageTitleWithCount } from '@/app/components/blocks/page-title-with-count';
import { TableSection } from '@/app/components/sections/table-section';
import { Table } from '@/app/components/base/tables/table';
import { TableBody } from '@/app/components/base/tables/table-body';
import { TableHead } from '@/app/components/base/tables/table-head';

/**
 *
 * @returns
 */
export function UserPage() {
  /**
   *loader
   */
  const { showLoader, hideLoader } = useRapidaStore();

  /**
   * for create a user modal
   */
  const [createUserModalOpen, setCreateUserModalOpen] = useState(false);

  /**
   * authentication with token
   */
  const { projectId, authId, token } = useCurrentCredential();
  const userActions = useUserPageStore();
  const onError = useCallback((err: string) => {
    hideLoader();
    toast.error(err);
  }, []);
  const onSuccess = useCallback((data: User[]) => {
    hideLoader();
  }, []);
  /**
   * call the api
   */
  const getUsers = useCallback((token, userId, projectId) => {
    showLoader();
    userActions.getAllUser(token, userId, projectId, onError, onSuccess);
  }, []);

  useEffect(() => {
    getUsers(token, authId, projectId);
  }, [userActions.page, userActions.pageSize, userActions.criteria]);
  /**
   *
   */
  return (
    <>
      <Helmet title="User and Teams" />
      <PageHeaderBlock>
        <PageTitleWithCount count={userActions.users.length} total={userActions.totalCount}>
          Users
        </PageTitleWithCount>
        <div className="flex items-stretch h-12 border-l border-gray-200 dark:border-gray-800">
          <button
            type="button"
            onClick={() => setCreateUserModalOpen(true)}
            className="flex items-center gap-2 px-4 text-sm text-white bg-primary hover:bg-primary/90 transition-colors whitespace-nowrap"
          >
            Invite user
            <Plus strokeWidth={1.5} className="w-4 h-4" />
          </button>
        </div>
      </PageHeaderBlock>
      <BluredWrapper className="sticky top-0 z-11">
        <SearchIconInput className="bg-light-background flex-1" />
        <PaginationButtonBlock className="shrink-0">
          <TablePagination
            columns={userActions.columns}
            currentPage={userActions.page}
            onChangeCurrentPage={userActions.setPage}
            totalItem={userActions.totalCount}
            pageSize={userActions.pageSize}
            onChangePageSize={userActions.setPageSize}
            onChangeColumns={userActions.setColumns}
          />
          <IButton onClick={() => getUsers(token, authId, projectId)}>
            <RotateCw strokeWidth={1.5} className="h-4 w-4" />
          </IButton>
        </PaginationButtonBlock>
      </BluredWrapper>
      <TableSection>
        <Table className="bg-white dark:bg-gray-900">
          <TableHead columns={userActions.columns} isActionable />
          <TableBody>
            {userActions.users.map((usr, idx) => {
              return <SingleUser key={idx} user={usr} />;
            })}
          </TableBody>
        </Table>
      </TableSection>
      <InviteUserDialog
        modalOpen={createUserModalOpen}
        setModalOpen={setCreateUserModalOpen}
        onSuccess={() => {
          getUsers(token, authId, projectId);
        }}
      ></InviteUserDialog>
    </>
  );
}
