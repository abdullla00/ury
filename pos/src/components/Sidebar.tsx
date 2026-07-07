import { 
  Grid3X3,
  UtensilsCrossed,
} from 'lucide-react';
import { usePOSStore } from '../store/pos-store';
import { cn } from '../lib/utils';
import { Button, Badge } from './ui';
import CommentDialog from './CommentDialog';
import { useState } from 'react';
import { t } from '../i18n';

interface SidebarProps {
  disabled?: boolean;
}

const Sidebar = ({ disabled }: SidebarProps) => {
  const { selectedCategory, setSelectedCategory, menuItems, categories, orderComment, setOrderComment } = usePOSStore();
  const [showCommentDialog, setShowCommentDialog] = useState(false);

  const getCategoryCount = (category: string) => {
    return menuItems.filter(item => item.course === category).length;
  };

  const getAllItemsCount = () => menuItems.length;

  const handleCommentSave = (comment: string) => {
    setOrderComment(comment);
  };

  const categoryButtonClass = (isActive: boolean) =>
    cn(
      'flex-shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium transition-all duration-200',
      isActive
        ? 'bg-blue-600 text-white shadow-sm'
        : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
    );

  const sidebarButtonClass = (isActive: boolean) =>
    cn(
      'w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium transition-all duration-200 group relative',
      isActive
        ? 'bg-white text-gray-900 shadow-sm font-semibold'
        : 'text-gray-700 hover:bg-white/60 hover:text-gray-900',
    );

  return (
    <>
      {/* Mobile / tablet category strip */}
      <div
        className={cn(
          'lg:hidden border-b border-gray-200 bg-white',
          disabled && 'pointer-events-none opacity-50',
        )}
      >
        <div className="scrollbar-hide flex gap-2 overflow-x-auto px-3 py-2.5">
          <Button
            onClick={() => setSelectedCategory('')}
            variant="ghost"
            className={categoryButtonClass(selectedCategory === '')}
            disabled={disabled}
          >
            <Grid3X3 className="h-4 w-4" />
            <span>{t('pos_sidebar.all_items')}</span>
            <Badge variant="secondary" size="sm" className="min-w-[20px] bg-white/20 text-inherit">
              {getAllItemsCount()}
            </Badge>
          </Button>

          {categories.map((category) => (
            <Button
              key={category.name}
              onClick={() => setSelectedCategory(category.name)}
              variant="ghost"
              className={categoryButtonClass(selectedCategory === category.name)}
              disabled={disabled}
            >
              <UtensilsCrossed className="h-4 w-4" />
              <span>{category.label}</span>
              <Badge variant="secondary" size="sm" className="min-w-[20px] bg-white/20 text-inherit">
                {getCategoryCount(category.name)}
              </Badge>
            </Button>
          ))}
        </div>
      </div>

      {/* Desktop sidebar */}
      <div
        className={cn(
          'hidden h-full w-56 flex-shrink-0 flex-col border-e border-gray-200 bg-white xl:w-64 lg:flex',
          disabled && 'pointer-events-none opacity-50',
        )}
      >
        <nav className="flex-1 overflow-y-auto p-4 xl:p-6">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <h2 className="mb-3 px-1 text-xs font-medium uppercase tracking-wide text-gray-500">
              {t('pos_sidebar.categories')}
            </h2>

            <Button
              onClick={() => setSelectedCategory('')}
              variant="ghost"
              className={sidebarButtonClass(selectedCategory === '')}
              disabled={disabled}
            >
              {selectedCategory === '' && (
                <div className="absolute start-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-e-full bg-blue-600" />
              )}
              <div className="ms-1 flex items-center gap-3">
                <Grid3X3 className="h-4 w-4 text-gray-500" />
                <span>{t('pos_sidebar.all_items')}</span>
              </div>
              <Badge variant="secondary" size="sm" className="min-w-[24px] bg-gray-100 text-center text-xs text-gray-500">
                {getAllItemsCount()}
              </Badge>
            </Button>

            <div className="mx-1 my-3 h-px bg-gray-200" />

            <div className="space-y-1">
              {categories.map((category) => (
                <Button
                  key={category.name}
                  onClick={() => setSelectedCategory(category.name)}
                  variant="ghost"
                  className={sidebarButtonClass(selectedCategory === category.name)}
                  disabled={disabled}
                >
                  {selectedCategory === category.name && (
                    <div className="absolute start-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-e-full bg-blue-600" />
                  )}
                  <div className="ms-1 flex items-center gap-3">
                    <UtensilsCrossed className="h-4 w-4 flex-shrink-0 text-gray-500" />
                    <span className="text-start">{category.label}</span>
                  </div>
                  <Badge variant="secondary" size="sm" className="min-w-[24px] bg-gray-100 text-center text-xs text-gray-500">
                    {getCategoryCount(category.name)}
                  </Badge>
                </Button>
              ))}
            </div>
          </div>
        </nav>

        <CommentDialog
          isOpen={showCommentDialog}
          onClose={() => setShowCommentDialog(false)}
          onSave={handleCommentSave}
          initialComment={orderComment}
        />
      </div>
    </>
  );
};

export default Sidebar;
