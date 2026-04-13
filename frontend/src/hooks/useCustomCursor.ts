import { useEffect } from 'react'

export const useCustomCursor = () => {
  useEffect(() => {
    // Create custom cursor element
    const cursor = document.createElement('div')
    cursor.id = 'cursor'
    document.body.appendChild(cursor)

    let mouseX = 0
    let mouseY = 0

    const moveCursor = (e: MouseEvent) => {
      mouseX = e.clientX
      mouseY = e.clientY

      cursor.style.left = mouseX - 6 + 'px'
      cursor.style.top = mouseY - 6 + 'px'
    }

    const handleMouseEnter = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (isInteractive(target)) {
        cursor.classList.add('hover')
      }
    }

    const handleMouseLeave = () => {
      cursor.classList.remove('hover')
    }

    const isInteractive = (el: HTMLElement): boolean => {
            const interactiveTags = ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA', 'LABEL']
                  if (interactiveTags.includes(el.tagName)) return true
                  
                  const role = el.getAttribute('role')
                        const interactiveRoles = ['button', 'link', 'menuitem', 'tab', 'checkbox', 'radio']
                              if (role && interactiveRoles.includes(role)) return true
                              
                              return el.onclick !== null || el.style.cursor === 'pointer'
                                }

    document.addEventListener('mousemove', moveCursor)
       document.addEventListener('mouseenter', handleMouseEnter, true)
          document.addEventListener('mouseleave', handleMouseLeave, true)

    // Add hover detection for interactive elements
    const addHoverListeners = () => {
            const interactiveElements = document.querySelectorAll('button, a, input, select, textarea, [role=\"button\"], [role=\"link\"], [onclick]')
            interactiveElements.forEach(el => {
              el.addEventListener('mouseenter', handleMouseEnter as any)
              el.addEventListener('mouseleave', handleMouseLeave)

          })
      }

    addHoverListeners


    return () => {
            document.removeEventListener('mousemove', moveCursor)
           document.removeEventListener('mouseenter', handleMouseEnter, true)
           document.removeEventListener('mouseleave', handleMouseLeave, true)
           cursor.remove()
              }
            }, [])
          }
