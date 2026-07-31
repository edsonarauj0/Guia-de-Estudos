"use client"

import * as React from "react"
import { ChevronsUpDown, Plus, FolderPlus } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { usePlanContext } from "@/contexts/PlanContext"

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuShortcut,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    SidebarMenu,
    SidebarMenuItem,
    useSidebar,
} from "@/components/ui/sidebar"

export function PlanSwitcher() {
    const { isMobile } = useSidebar()
    const { plans, selectedPlanId, selectPlan } = usePlanContext()
    const navigate = useNavigate()

    const activePlan = plans.find((p) => p.id === selectedPlanId) || plans[0]

    if (!activePlan) {
        return (
            <div className="text-xs text-muted-foreground px-2 py-1">
                Nenhum planejamento encontrado
            </div>
        )
    }

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <DropdownMenu>
                    <DropdownMenuTrigger className="peer/menu-button group/menu-button  hover:bg-secondary flex w-full items-center gap-2 overflow-hidden rounded-sm p-2 text-left text-sm outline-none ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground h-12">
                        <div className="flex aspect-square size-8 items-center justify-center rounded-sm bg-primary/20 text-primary">
                            <FolderPlus className="size-4" />
                        </div>
                        <div className="grid flex-1 text-left text-sm leading-tight">
                            <span className="truncate font-medium">{activePlan.name}</span>
                            <span className="truncate text-xs text-muted-foreground">Planejamento Ativo</span>
                        </div>
                        <ChevronsUpDown className="ml-auto size-4" />
                    </DropdownMenuTrigger>

                    <DropdownMenuContent
                        className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-sm"
                        align="start"
                        side={isMobile ? "bottom" : "right"}
                        sideOffset={4}
                    >
                        <DropdownMenuGroup>
                            <DropdownMenuLabel className="text-xs text-muted-foreground">
                                Planejamentos de Estudos
                            </DropdownMenuLabel>
                            {plans.map((plan, index) => (
                                <DropdownMenuItem
                                    key={plan.id}
                                    onClick={() => selectPlan(plan.id)}
                                    className="gap-2 p-2 cursor-pointer"
                                >
                                    <div className="flex size-6 items-center justify-center rounded-sm border bg-card">
                                        <FolderPlus className="size-3.5 shrink-0 text-primary" />
                                    </div>
                                    <span className="truncate flex-1">{plan.name}</span>
                                    {index < 9 && <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={() => navigate('/plans')}
                            className="gap-2 p-2 cursor-pointer"
                        >
                            <div className="flex size-6 items-center justify-center rounded-sm border bg-transparent">
                                <Plus className="size-4" />
                            </div>
                            <div className="font-medium text-muted-foreground">Gerenciar / Criar Plano</div>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>
        </SidebarMenu>
    )
}