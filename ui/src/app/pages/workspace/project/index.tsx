import { useCallback, useEffect, useState } from 'react';
import { Helmet } from '@/app/components/helmet';
import {
  ArchiveProjectResponse,
  GetAllProjectResponse,
  Project,
} from '@rapidaai/react';
import { CreateProjectDialog } from '@/app/components/base/modal/create-project-modal';
import { GetAllProject, DeleteProject } from '@rapidaai/react';
import { useCredential } from '@/hooks/use-credential';
import toast from 'react-hot-toast/headless';
import { SearchIconInput } from '@/app/components/form/input/IconInput';
import { TablePagination } from '@/app/components/base/tables/table-pagination';
import { useRapidaStore } from '@/hooks';
import { BluredWrapper } from '@/app/components/wrapper/blured-wrapper';
import { ServiceError } from '@rapidaai/react';
import { IButton } from '@/app/components/form/button';
import { Plus, RotateCw } from 'lucide-react';
import { PaginationButtonBlock } from '@/app/components/blocks/pagination-button-block';
import { Table } from '@/app/components/base/tables/table';
import { TableHead } from '@/app/components/base/tables/table-head';
import { TableBody } from '@/app/components/base/tables/table-body';
import { TableRow } from '@/app/components/base/tables/table-row';
import { TableCell } from '@/app/components/base/tables/table-cell';
import { ProjectUserGroupAvatar } from '@/app/components/avatar/project-user-group-avatar';
import { toHumanReadableDate } from '@/utils/date';
import { RoleIndicator } from '@/app/components/indicators/role';
import { ProjectOption } from '@/app/pages/workspace/project/project-options';
import { PageHeaderBlock } from '@/app/components/blocks/page-header-block';
import { PageTitleWithCount } from '@/app/components/blocks/page-title-with-count';
import { TableSection } from '@/app/components/sections/table-section';
import { connectionConfig } from '@/configs';
export function ProjectPage() {
  /**
   *
   */
  const [createProjectModalOpen, setCreateProjectModalOpen] = useState(false);

  /**
   * loading context
   */
  const { showLoader, hideLoader } = useRapidaStore();

  /**
   * Credentials
   */
  const [userId, token] = useCredential();

  /**
   * List of projects
   */
  const [projects, setProjects] = useState<Project[]>([]);

  /**
   * pagination and search capabilities
   */

  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);

  /**
   * filter apply
   */
  const [criteria] = useState<{ key: string; value: string }[]>([]);

  /**
   *
   */
  const afterGettingProject = useCallback(
    (err: ServiceError | null, alpr: GetAllProjectResponse | null) => {
      hideLoader();
      if (err) {
        toast.error('Unable to process your request. please try again later.');
        return;
      }
      if (alpr?.getSuccess()) {
        setProjects(alpr.getDataList());
        let paginated = alpr.getPaginated();
        if (paginated) {
          setTotalCount(paginated.getTotalitem());
        }
      }
    },
    [],
  );

  /**
   *
   * @param page
   * @param pageSize
   * @param criteria
   * @returns
   */
  const getAllProject = (
    page: number,
    pageSize: number,
    criteria: { key: string; value: string }[],
  ) => {
    showLoader();
    return GetAllProject(
      connectionConfig,
      page,
      pageSize,
      criteria,
      afterGettingProject,
      {
        authorization: token,
        'x-auth-id': userId,
      },
    );
  };

  /**
   *
   */
  useEffect(() => {
    getAllProject(page, pageSize, criteria);
  }, [page, pageSize, criteria]);

  /**
   *
   * @param projectId
   */
  const onDeleteProject = (projectId: string) => {
    DeleteProject(
      connectionConfig,
      projectId,
      (err: ServiceError | null, apr: ArchiveProjectResponse | null) => {
        if (err) {
          return;
        }
        if (apr?.getSuccess()) {
          const newList = projects?.filter(p => p.getId() !== apr.getId());
          setProjects(newList);
        }
      },
      {
        authorization: token,
        'x-auth-id': userId,
      },
    );
  };

  return (
    <>
      <Helmet title="Projects" />
      <PageHeaderBlock>
        <PageTitleWithCount count={projects.length} total={totalCount}>
          Projects
        </PageTitleWithCount>
        <div className="flex items-stretch h-12 border-l border-gray-200 dark:border-gray-800">
          <button
            type="button"
            onClick={() => setCreateProjectModalOpen(true)}
            className="flex items-center gap-2 px-4 text-sm text-white bg-primary hover:bg-primary/90 transition-colors whitespace-nowrap"
          >
            Create new project
            <Plus strokeWidth={1.5} className="w-4 h-4" />
          </button>
        </div>
      </PageHeaderBlock>
      <BluredWrapper className="sticky top-0 z-11">
        <SearchIconInput className="bg-light-background flex-1" />
        <PaginationButtonBlock className="shrink-0">
          <TablePagination
            currentPage={page}
            onChangeCurrentPage={setPage}
            totalItem={totalCount}
            pageSize={pageSize}
            onChangePageSize={setPageSize}
          />
          <IButton onClick={() => getAllProject(page, pageSize, criteria)}>
            <RotateCw strokeWidth={1.5} className="h-4 w-4" />
          </IButton>
        </PaginationButtonBlock>
      </BluredWrapper>
      <TableSection>
        <Table className="bg-white dark:bg-gray-900">
          <TableHead
            isActionable
            columns={[
              { name: 'Name', key: 'name' },
              { name: 'Date Created', key: 'createdDate' },
              { name: 'Your Role', key: 'role' },
              { name: 'Collaborators', key: 'collaborators' },
            ]}
          ></TableHead>
          <TableBody className="">
            {projects.map(project => (
              <TableRow key={project.getId()}>
                <TableCell>{project.getName()}</TableCell>
                <TableCell>
                  {project.getCreateddate() &&
                    toHumanReadableDate(project.getCreateddate()!)}
                </TableCell>
                <TableCell>
                  <RoleIndicator role={'SUPER_ADMIN'} />
                </TableCell>
                <TableCell>
                  <ProjectUserGroupAvatar
                    members={project
                      .getMembersList()
                      .map(m => ({ name: m.getName() }))}
                    size={7}
                    projectId={project.getId()}
                  />
                </TableCell>
                <TableCell>
                  <ProjectOption
                    project={project.toObject()}
                    afterUpdateProject={() => {
                      getAllProject(page, pageSize, criteria);
                    }}
                    onDelete={() => onDeleteProject(project.getId())}
                  ></ProjectOption>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <CreateProjectDialog
          modalOpen={createProjectModalOpen}
          setModalOpen={setCreateProjectModalOpen}
          afterCreateProject={() => {
            getAllProject(page, pageSize, criteria);
          }}
        />
      </TableSection>
    </>
  );
}
