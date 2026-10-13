import { User, Role } from './TeamManagementTypes';

/**
 * Enterprise Permission Engine
 * Evaluates whether a user has a specific permission based on their assigned Roles,
 * legacy direct permissions, and standard-clause hierarchical inheritance with exceptions.
 */
export function hasUserPermission(
  user: User | null | undefined,
  roles: Role[],
  permissionKey: string,
  clauseId?: string,
  action?: 'view' | 'create' | 'edit' | 'delete' | 'print' | 'export' | 'import' | 'approve' | 'reject' | 'versionControl' | 'attachments' | 'history' | 'logs'
): boolean {
  if (!user) return false;

  // 1. Super Admin Bypass: The dedicated System Administrator has absolute access
  if (user.username.toLowerCase() === 'sysadmin') {
    return true;
  }

  // Legacy role check fallback: if user role is admin, they are granted admin views
  if (user.role === 'admin' && !clauseId) {
    return true;
  }

  // Get active enabled roles assigned to the user
  const userRoles = roles.filter(
    (r) => user.roleIds?.includes(r.id) && r.isEnabled && (r.companyId === user.companyId || r.isSystem)
  );

  // 2. View/Page level permission evaluation
  if (!clauseId) {
    // If any assigned role allows it, or user has direct legacy override permission
    const allowedByRole = userRoles.some((r) => r.permissions[permissionKey as keyof typeof r.permissions] === true);
    const allowedDirectly = user.permissions[permissionKey as keyof typeof user.permissions] === true;
    return allowedByRole || allowedDirectly;
  }

  // 3. Granular Clause Tree Permission evaluation (Standard Clause Hierarchy & Inheritance)
  const checkSingleClausePermission = (currId: string): boolean | null => {
    // A. Check user direct override exception
    if (user.permissions?.clauses?.[currId]) {
      const pLegacy = user.permissions.clauses[currId];
      // For legacy, we map view/docList/archive to action
      if (action) {
        if (action === 'view') return pLegacy.view;
        if (action === 'create' || action === 'edit' || action === 'delete') return pLegacy.docList;
        return pLegacy.archive; // default fallback for other actions
      }
    }

    // B. Check role-level configurations
    let roleDecision: boolean | null = null;
    for (const role of userRoles) {
      if (role.permissions?.clauses?.[currId]) {
        const cPerm = role.permissions.clauses[currId];
        if (action) {
          const val = cPerm[action];
          if (val !== undefined) {
            // If any role grants permission, we return true immediately
            if (val === true) return true;
            // Otherwise we save the false to potentially override (unless another role grants it)
            roleDecision = false;
          }
        }
      }
    }

    return roleDecision;
  };

  // Traverse upwards from child standard clause to parent (Inheritance!)
  // E.g., "8.5.1.1" -> "8.5.1" -> "8.5" -> "8"
  let currentId = clauseId;
  while (currentId) {
    const decision = checkSingleClausePermission(currentId);
    if (decision !== null) {
      return decision;
    }

    // Move to parent
    const lastDotIndex = currentId.lastIndexOf('.');
    if (lastDotIndex === -1) break;
    currentId = currentId.substring(0, lastDotIndex);
  }

  // Fallback: Default to false for secure design or true for general viewing if legacy config
  return false;
}
