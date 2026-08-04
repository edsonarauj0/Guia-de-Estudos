import { type LucideIcon, ExternalLink, HelpCircle, RotateCcw, Pencil, Trash2, MoreHorizontal } from "lucide-react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

interface SubjectProject {
  id: string
  name: string
  url: string
  icon: LucideIcon
  color?: string
  onDelete?: () => void
}

export function NavMaterias({ projects }: { projects: SubjectProject[] }) {
  const { isMobile } = useSidebar()
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Matérias</SidebarGroupLabel>
      <SidebarMenu>
        {projects.map((item) => {
          const isActive = location.pathname === item.url
          return (
            <SidebarMenuItem key={item.id}>
              <SidebarMenuButton asChild isActive={isActive} tooltip={item.name}>
                <Link to={item.url}>
                  {item.color ? (
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                  ) : (
                    <item.icon />
                  )}
                  <span>{item.name}</span>
                </Link>
              </SidebarMenuButton>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuAction showOnHover>
                    <MoreHorizontal className="w-4 h-4" />
                    <span className="sr-only">Ações de {item.name}</span>
                  </SidebarMenuAction>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                  className="w-52 rounded-lg"
                  side={isMobile ? "bottom" : "right"}
                  align={isMobile ? "end" : "start"}
                >
                  {/* Ver detalhes */}
                  <DropdownMenuItem onClick={() => navigate(item.url)}>
                    <ExternalLink className="w-4 h-4 text-muted-foreground" />
                    <span>Ver detalhes</span>
                  </DropdownMenuItem>

                  {/* Registrar questões */}
                  <DropdownMenuItem onClick={() => navigate('/questions')}>
                    <HelpCircle className="w-4 h-4 text-muted-foreground" />
                    <span>Registrar questões</span>
                  </DropdownMenuItem>

                  {/* Ver revisões */}
                  <DropdownMenuItem onClick={() => navigate('/reviews')}>
                    <RotateCcw className="w-4 h-4 text-muted-foreground" />
                    <span>Ver revisões</span>
                  </DropdownMenuItem>

                  {/* Editar matéria */}
                  <DropdownMenuItem onClick={() => navigate('/subjects')}>
                    <Pencil className="w-4 h-4 text-muted-foreground" />
                    <span>Editar matéria</span>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  {/* Excluir */}
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive focus:bg-destructive/10"
                    onClick={() => item.onDelete?.()}
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Excluir matéria</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
