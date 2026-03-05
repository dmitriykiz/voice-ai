import React, { useCallback, useEffect, useState } from 'react';
import { Helmet } from '@/app/components/helmet';
import { useCredential } from '@/hooks/use-credential';
import { useRapidaStore } from '@/hooks';
import { TablePagination } from '@/app/components/base/tables/table-pagination';
import { SearchIconInput } from '@/app/components/form/input/IconInput';
import { BluredWrapper } from '@/app/components/wrapper/blured-wrapper';
import toast from 'react-hot-toast/headless';
import { useKnowledgePageStore } from '@/hooks/use-knowledge-page-store';
import { Knowledge } from '@rapidaai/react';
import { Spinner } from '@/app/components/loader/spinner';
import { ClickableKnowledgeCard } from '@/app/components/base/cards/knowledge-card';
import { ActionableEmptyMessage } from '@/app/components/container/message/actionable-empty-message';
import { HowKnowledgeWorksDialog } from '@/app/components/base/modal/how-it-works-modal/how-knowledge-works';
import { useGlobalNavigation } from '@/hooks/use-global-navigator';
import { IBlueButton, IButton } from '@/app/components/form/button';
import { Plus, RotateCw } from 'lucide-react';
import { PageHeaderBlock } from '@/app/components/blocks/page-header-block';
import { PageTitleBlock } from '@/app/components/blocks/page-title-block';
import { cn } from '@/utils';
import { PaginationButtonBlock } from '@/app/components/blocks/pagination-button-block';

/**
 * Knowledge base page
 * @returns
 */
export function KnowledgePage() {
  /**
   *
   */
  const { goToCreateKnowledge } = useGlobalNavigation();
  const [userId, token, projectId] = useCredential();
  const knowledgeActions = useKnowledgePageStore();
  const { loading, showLoader, hideLoader } = useRapidaStore();
  const [hiw, sethiw] = useState(false);

  const onError = useCallback((err: string) => {
    hideLoader();
    toast.error(err);
  }, []);
  const onSuccess = useCallback((data: Knowledge[]) => {
    hideLoader();
  }, []);
  /**
   * call the api
   */
  const getKnowledges = useCallback((projectId, token, userId) => {
    showLoader();
    knowledgeActions.getAllKnowledge(
      projectId,
      token,
      userId,
      onError,
      onSuccess,
    );
  }, []);

  useEffect(() => {
    getKnowledges(projectId, token, userId);
  }, [
    projectId,
    knowledgeActions.page,
    knowledgeActions.pageSize,
    knowledgeActions.criteria,
  ]);

  return (
    <div className={cn('flex flex-col h-full flex-1 overflow-auto')}>
      <Helmet title="Knowledge" />
      <HowKnowledgeWorksDialog setModalOpen={sethiw} modalOpen={hiw} />
      <PageHeaderBlock>
        <div className="flex items-center gap-3">
          <PageTitleBlock>Knowledge bases</PageTitleBlock>
          <div className="text-xs opacity-75">
            {`${knowledgeActions.knowledgeBases.length}/${knowledgeActions.totalCount}`}
          </div>
        </div>
        <div className="flex divide-x dark:divide-gray-800">
          <IButton
            onClick={() => {
              sethiw(!hiw);
            }}
          >
            How it works?
          </IButton>

          <IBlueButton
            onClick={() => {
              goToCreateKnowledge();
            }}
          >
            Add new knowledge
            <Plus strokeWidth={1.5} className="ml-1.5 h-4 w-4" />
          </IBlueButton>
        </div>
      </PageHeaderBlock>

      <BluredWrapper className="p-0">
        <SearchIconInput className="bg-light-background" />
        <PaginationButtonBlock>
          <TablePagination
            currentPage={knowledgeActions.page}
            onChangeCurrentPage={knowledgeActions.setPage}
            totalItem={knowledgeActions.totalCount}
            pageSize={knowledgeActions.pageSize}
            onChangePageSize={knowledgeActions.setPageSize}
          />
          <IButton
            onClick={() => {
              getKnowledges(projectId, token, userId);
            }}
          >
            <RotateCw strokeWidth={1.5} className="h-4 w-4" />
          </IButton>
        </PaginationButtonBlock>
      </BluredWrapper>

      {knowledgeActions.knowledgeBases &&
      knowledgeActions.knowledgeBases.length > 0 ? (
        <section className="grid content-start grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-[2px] grow shrink-0 m-4">
          {knowledgeActions.knowledgeBases.map((kf, idx) => (
            <ClickableKnowledgeCard key={idx} knowledge={kf} />
          ))}
        </section>
      ) : knowledgeActions.criteria.length > 0 ? (
        <div className="flex flex-col h-full flex-1 items-center justify-center">
          <ActionableEmptyMessage
            title="No knowledge bases found"
            subtitle="No knowledge bases match your search criteria."
            action="Create new knowledge"
            onActionClick={goToCreateKnowledge}
          />
        </div>
      ) : !loading ? (
        <div className="flex flex-col h-full flex-1 items-center justify-center">
          <ActionableEmptyMessage
            title="No knowledge bases"
            subtitle="You haven't created any knowledge bases yet."
            action="Create new knowledge"
            onActionClick={goToCreateKnowledge}
          />
        </div>
      ) : (
        <div className="h-full flex justify-center items-center">
          <Spinner size="md" />
        </div>
      )}
    </div>
  );
}
