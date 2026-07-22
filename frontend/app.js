/**
 * Core Application Controller
 * Matches exactly the operations and behavior of Apurva's portfolio site.
 * Coordinates sticky navigation links, dark/light theme switching, 
 * scroll reveal animations, and form validation notifications.
 */

document.addEventListener('DOMContentLoaded', () => {
  
  // 1. Mobile Menu Drawer Navigation
  const menuToggle = document.getElementById('menuToggle');
  const navMenu = document.getElementById('navMenu');
  const menuIcon = menuToggle ? menuToggle.querySelector('svg') : null;
  
  if (menuToggle && navMenu) {
    menuToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isActive = navMenu.classList.toggle('active');
      
      // Update SVG toggle icon based on active menu state
      if (menuIcon) {
        if (isActive) {
          // Cross / Close Icon
          menuIcon.innerHTML = `
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          `;
        } else {
          // Hamburger Icon
          menuIcon.innerHTML = `
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          `;
        }
      }
    });

    // Close menu when clicking navigation links
    const navLinks = navMenu.querySelectorAll('.nav-item a');
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('active');
        if (menuIcon) {
          menuIcon.innerHTML = `
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          `;
        }
      });
    });

    // Close menu when clicking anywhere else
    document.addEventListener('click', (e) => {
      if (!navMenu.contains(e.target) && !menuToggle.contains(e.target)) {
        navMenu.classList.remove('active');
        if (menuIcon) {
          menuIcon.innerHTML = `
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          `;
        }
      }
    });
  }

  // 2. Dark / Light Theme Toggle Switcher
  const themeToggle = document.getElementById('themeToggleInput');
  const currentTheme = localStorage.getItem('theme') || 'dark';
  
  document.documentElement.setAttribute('data-theme', currentTheme);
  
  if (themeToggle) {
    themeToggle.checked = currentTheme === 'light';
    
    themeToggle.addEventListener('change', () => {
      const targetTheme = themeToggle.checked ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', targetTheme);
      localStorage.setItem('theme', targetTheme);
    });
  }

  // 3. Scroll Active Link Highlight Tracker
  const sections = document.querySelectorAll('section');
  const navItems = document.querySelectorAll('.nav-menu .nav-item');
  
  const highlightActiveLink = () => {
    let currentActiveId = '';
    const scrollPos = window.scrollY + 120; // offset top navbar height
    
    sections.forEach(section => {
      const sectionTop = section.offsetTop;
      const sectionHeight = section.offsetHeight;
      if (scrollPos >= sectionTop && scrollPos < sectionTop + sectionHeight) {
        currentActiveId = section.getAttribute('id');
      }
    });
    
    navItems.forEach(item => {
      item.classList.remove('active');
      const linkHref = item.querySelector('a').getAttribute('href');
      if (linkHref === `#${currentActiveId}`) {
        item.classList.add('active');
      }
    });
  };

  window.addEventListener('scroll', highlightActiveLink);
  window.addEventListener('load', highlightActiveLink);

  // 4. Scroll Reveal Handler (Animations)
  const revealElements = document.querySelectorAll('.reveal');
  
  const checkReveal = () => {
    const triggerBottom = window.innerHeight * 0.85; // Reveal when 85% of element is scrolled into view
    
    revealElements.forEach(element => {
      const elementTop = element.getBoundingClientRect().top;
      if (elementTop < triggerBottom) {
        element.classList.add('active');
      }
    });
  };

  window.addEventListener('scroll', checkReveal);
  window.addEventListener('load', checkReveal);
  
  // Run once immediately on load
  checkReveal();

  // 5. Contact Form Submission Dispatcher
  const contactForm = document.getElementById('contactForm');
  const formAlert = document.getElementById('formAlert');
  
  if (contactForm && formAlert) {
    // Made this callback async to cleanly handle serverless network boundaries
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const name = document.getElementById('formName').value.trim();
      const email = document.getElementById('formEmail').value.trim();
      const message = document.getElementById('formMessage').value.trim();
      
      if (!name || !email || !message) {
        showFeedback('Please fill out all required fields.', 'error');
        return;
      }
      
      // Target your deployed production Azure Function route
      const functionApiUrl = 'https://sadev-portfolio-counter-ajc3hrg9d7djexe5.southeastasia-01.azurewebsites.net/api/send_message';
      
      try {
        // Dispatch the form payload across the network border
        const response = await fetch(functionApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ name, email, message })
        });

        if (response.ok) {
          showFeedback('Thank you! Your message has been sent successfully.', 'success');
          contactForm.reset();
        } else {
          showFeedback('Server rejected message. Please verify your data fields.', 'error');
        }
      } catch (error) {
        console.error('Error submitting form ticket telemetry:', error);
        showFeedback('Failed to connect to the network. Please try again later.', 'error');
      }
    });
  }
  
  function showFeedback(msg, type) {
    if (!formAlert) return;
    
    formAlert.textContent = msg;
    formAlert.className = `form-alert ${type}`;
    formAlert.style.display = 'block';
    
    // Auto-scroll to show alert message
    formAlert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    
    setTimeout(() => {
      formAlert.style.display = 'none';
    }, 6000);
  }

  // 6. Live Azure Serverless Visitor Counter API Integration
  const visitorCountEl = document.getElementById('visitorCount');
  
  const updateVisitorCounter = async () => {
    // Target your newly deployed standalone production Azure Function URL
    const azureFunctionApiUrl = 'https://sadev-portfolio-counter-ajc3hrg9d7djexe5.southeastasia-01.azurewebsites.net/api/visitor_counter';
    
    if (visitorCountEl) {
      try {
        // Querying live transactional record state from Azure Cosmos DB
        const response = await fetch(azureFunctionApiUrl);
        if (!response.ok) throw new Error('API server boundary connection error.');
        
        // Parse the raw text response: "Visitor count updated to: X"
        const textData = await response.text(); 
        
        // Extract the numerical digits from the text string using regex
        const matches = textData.match(/\d+/);
        const count = matches ? parseInt(matches[0], 10) : 0;
        
        // Format integer text neatly with structural standard delimiter breaks (e.g., 1,482)
        const formatNumber = (num) => num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        
        visitorCountEl.textContent = formatNumber(count);
      } catch (error) {
        console.error('Error fetching live visitor telemetry:', error);
        visitorCountEl.textContent = "---"; // Safe graceful static state fallback 
      }
    }
   };

  // Dispatch API tunnel transaction on initial lifecycle paint load
  updateVisitorCounter();

  // 7. Live Observability Infrastructure Topology Graph (Cloud & DevOps Nodes)
  const canvas = document.getElementById('techBackground');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Track mouse coordinates for interactive node scale/inspect tooltips
    const mouse = { x: null, y: null };
    window.addEventListener('mousemove', (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    });
    window.addEventListener('mouseleave', () => {
      mouse.x = null;
      mouse.y = null;
    });

    window.addEventListener('resize', () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    });

    // Node names representing microservices, databases, routers, caches
    const nodeNames = [
      'srv-ec2-api', 'pod-auth-0', 'pod-auth-1', 'srv-rds-db', 
      'api-gateway', 'cache-redis', 'pod-billing', 'mq-broker',
      'pod-worker-a', 'pod-worker-b', 'srv-dns-route', 'cdn-edge-0'
    ];

    // Status codes
    const statuses = ['HEALTHY', 'ACTIVE', 'SYNCING'];

    class CloudNode {
      constructor(index) {
        this.x = Math.random() * (width - 160) + 80;
        this.y = Math.random() * (height - 160) + 80;
        this.vx = (Math.random() - 0.5) * 0.18; // extremely slow drift
        this.vy = (Math.random() - 0.5) * 0.18;
        this.radius = Math.random() * 4 + 7; // node radius (7px to 11px)
        this.name = nodeNames[index % nodeNames.length] || `node-${index}`;
        this.ip = `10.0.1.${Math.floor(Math.random() * 253) + 2}`;
        this.status = statuses[Math.floor(Math.random() * statuses.length)];
        this.cpu = Math.floor(Math.random() * 40) + 10; // 10% to 50% CPU load
        this.activeGlow = 0; // Hover scaling factor
      }

      update() {
        this.x += this.vx;
        this.y += this.vy;

        // Bounce boundaries
        if (this.x < 50 || this.x > width - 50) this.vx = -this.vx;
        if (this.y < 50 || this.y > height - 50) this.vy = -this.vy;

        // Mouse hover interaction: check distance
        if (mouse.x !== null && mouse.y !== null) {
          const dx = mouse.x - this.x;
          const dy = mouse.y - this.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 45) {
            this.activeGlow = Math.min(1, this.activeGlow + 0.1); // expand ring
          } else {
            this.activeGlow = Math.max(0, this.activeGlow - 0.08); // shrink back
          }
        } else {
          this.activeGlow = Math.max(0, this.activeGlow - 0.08);
        }
      }

      draw(isLight) {
        // Draw connection outer ring (glow)
        const sizeMultiplier = 1 + this.activeGlow * 0.6;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * sizeMultiplier + 5, 0, Math.PI * 2);
        ctx.fillStyle = isLight ? 'rgba(108, 92, 231, 0.04)' : 'rgba(172, 129, 192, 0.06)';
        ctx.fill();
        
        ctx.strokeStyle = isLight ? 
          `rgba(108, 92, 231, ${0.15 + this.activeGlow * 0.35})` : 
          `rgba(172, 129, 192, ${0.25 + this.activeGlow * 0.45})`;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Draw core node point
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = isLight ? 'var(--accent-color)' : 'var(--accent-secondary)';
        ctx.fill();

        // If hovered, draw a tiny green health dot in core center
        if (this.activeGlow > 0.1) {
          ctx.beginPath();
          ctx.arc(this.x, this.y, 2, 0, Math.PI * 2);
          ctx.fillStyle = '#10b981';
          ctx.fill();
        }

        // Draw node hostnames text labels next to them (very faint on dark background)
        ctx.font = '700 9px var(--font-mono)';
        ctx.fillStyle = isLight ? 'rgba(0, 71, 65, 0.35)' : 'rgba(240, 237, 228, 0.35)';
        ctx.fillText(this.name, this.x + this.radius + 6, this.y + 3);

        // Draw telemetry metrics box if activeGlow is high
        if (this.activeGlow > 0.1) {
          ctx.font = '700 8.5px var(--font-mono)';
          ctx.fillStyle = isLight ? 'rgba(0, 71, 65, 0.85)' : 'rgba(240, 237, 228, 0.85)';
          
          // Background box for inspection text
          const boxW = 85;
          const boxH = 38;
          const boxX = this.x + this.radius + 6;
          const boxY = this.y + 10;
          
          ctx.fillStyle = isLight ? 'rgba(240, 237, 228, 0.95)' : 'rgba(10, 11, 20, 0.95)';
          ctx.strokeStyle = isLight ? 'rgba(108, 92, 231, 0.3)' : 'rgba(172, 129, 192, 0.4)';
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.roundRect(boxX, boxY, boxW, boxH, 4);
          ctx.fill();
          ctx.stroke();

          // Write metrics
          ctx.fillStyle = isLight ? '#004741' : '#F0EDE4';
          ctx.fillText(`IP: ${this.ip}`, boxX + 6, boxY + 11);
          ctx.fillText(`CPU: ${this.cpu}%`, boxX + 6, boxY + 21);
          
          // Health Status (Green text)
          ctx.fillStyle = '#10b981';
          ctx.fillText(`STATUS: ${this.status}`, boxX + 6, boxY + 31);
        }
      }
    }

    class DataPacket {
      constructor(fromNode, toNode) {
        this.from = fromNode;
        this.to = toNode;
        this.progress = 0;
        this.speed = Math.random() * 0.015 + 0.008; // speed along connection line (0% to 100%)
        this.color = Math.random() > 0.5 ? 'var(--accent-color)' : 'var(--accent-secondary)';
      }

      update() {
        this.progress += this.speed;
      }

      draw() {
        if (this.progress > 1) return;
        
        // Calculate coordinates along linear connection path
        const px = this.from.x + (this.to.x - this.from.x) * this.progress;
        const py = this.from.y + (this.to.y - this.from.y) * this.progress;

        ctx.beginPath();
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 5;
        ctx.fill();
        ctx.shadowBlur = 0; // reset
      }
    }

    // Initialize 12 Cloud Nodes
    const nodes = [];
    for (let i = 0; i < 12; i++) {
      nodes.push(new CloudNode(i));
    }

    // Active data packets in transport
    const packets = [];

    // Trigger random packet pings between close nodes
    setInterval(() => {
      if (nodes.length < 2) return;
      // Pick random source node
      const fromNode = nodes[Math.floor(Math.random() * nodes.length)];
      // Find candidate destination nodes closer than 190px
      const candidates = nodes.filter(n => {
        if (n === fromNode) return false;
        const dist = Math.sqrt(Math.pow(n.x - fromNode.x, 2) + Math.pow(n.y - fromNode.y, 2));
        return dist < 190;
      });

      if (candidates.length > 0 && packets.length < 25) {
        const toNode = candidates[Math.floor(Math.random() * candidates.length)];
        packets.push(new DataPacket(fromNode, toNode));
      }
    }, 450);

    // Animation loop
    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      const isLight = document.documentElement.getAttribute('data-theme') === 'light';

      // 1. Draw connection pipelines (faint dotted lines)
      ctx.strokeStyle = isLight ? 'rgba(108, 92, 231, 0.05)' : 'rgba(172, 129, 192, 0.09)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const n1 = nodes[i];
          const n2 = nodes[j];
          const dist = Math.sqrt(Math.pow(n1.x - n2.x, 2) + Math.pow(n1.y - n2.y, 2));
          if (dist < 190) {
            ctx.beginPath();
            ctx.moveTo(n1.x, n1.y);
            ctx.lineTo(n2.x, n2.y);
            ctx.stroke();
          }
        }
      }
      ctx.setLineDash([]); // Reset line dash styling

      // 2. Update and Draw Data Packets
      for (let i = packets.length - 1; i >= 0; i--) {
        const p = packets[i];
        p.update();
        p.draw();
        // Remove completed transport packets
        if (p.progress > 1) {
          packets.splice(i, 1);
        }
      }

      // 3. Update and Draw Cloud Nodes
      nodes.forEach(n => {
        n.update();
        n.draw(isLight);
      });

      requestAnimationFrame(animate);
    };

    animate();
  }

  // 8. Horizontal Slide Carousel Controls (3D Infinite Ribbon Loop Chain)
  const setupCarousel = (wrapper) => {
    if (!wrapper) return;
    
    const grid = wrapper.querySelector('.certs-grid');
    const prevBtn = wrapper.querySelector('.prev-btn');
    const nextBtn = wrapper.querySelector('.next-btn');
    if (!grid || !prevBtn || !nextBtn) return;
    
    const cards = Array.from(grid.querySelectorAll('.cert-card'));
    if (cards.length === 0) return;
    
    // Start with the center card active
    let activeIdx = Math.floor(cards.length / 2);
    
    const updatePositions = () => {
      if (window.innerWidth <= 768) {
        // Revert inline styles on mobile to fallback to native horizontal flex swipe scroll
        cards.forEach(card => {
          card.style.transform = '';
          card.style.opacity = '';
          card.style.zIndex = '';
          card.style.pointerEvents = '';
        });
        return;
      }
      
      const len = cards.length;
      
      // Standard 3-visible card setup (Skills, Projects, Certs)
      const isCerts = grid.classList.contains('certs-grid');
      const shiftX = isCerts ? 280 : 340; // tighter spacing for narrow cert cards
      const hideX = isCerts ? 460 : 550;
      
      cards.forEach((card, i) => {
        let offset = i - activeIdx;
        while (offset > len / 2) offset -= len;
        while (offset < -len / 2) offset += len;
        
        if (offset === 0) {
          card.style.transform = 'translate(-50%, -50%) scale(1)';
          card.style.opacity = '1';
          card.style.zIndex = '10';
          card.style.pointerEvents = 'auto';
        } else if (offset === -1) {
          card.style.transform = `translate(calc(-50% - ${shiftX}px), -50%) scale(0.85)`;
          card.style.opacity = '0.65';
          card.style.zIndex = '5';
          card.style.pointerEvents = 'auto';
        } else if (offset === 1) {
          card.style.transform = `translate(calc(-50% + ${shiftX}px), -50%) scale(0.85)`;
          card.style.opacity = '0.65';
          card.style.zIndex = '5';
          card.style.pointerEvents = 'auto';
        } else if (offset < -1) {
          card.style.transform = `translate(calc(-50% - ${hideX}px), -50%) scale(0.7)`;
          card.style.opacity = '0';
          card.style.zIndex = '1';
          card.style.pointerEvents = 'none';
        } else if (offset > 1) {
          card.style.transform = `translate(calc(-50% + ${hideX}px), -50%) scale(0.7)`;
          card.style.opacity = '0';
          card.style.zIndex = '1';
          card.style.pointerEvents = 'none';
        }
      });
    };
    
    prevBtn.addEventListener('click', () => {
      activeIdx = (activeIdx - 1 + cards.length) % cards.length;
      updatePositions();
    });
    
    nextBtn.addEventListener('click', () => {
      activeIdx = (activeIdx + 1) % cards.length;
      updatePositions();
    });
    
    // Sync on resize or initialization
    window.addEventListener('resize', updatePositions);
    updatePositions();
  };

  document.querySelectorAll('.carousel-wrapper').forEach(setupCarousel);

  // 9. Skills Expand/Collapse Toggle
  const skillsGrid = document.getElementById('skills-grid-new');
  const showAllBtn = document.getElementById('show-all-skills-btn');
  if (skillsGrid && showAllBtn) {
    const btnText = showAllBtn.querySelector('.btn-text');
    showAllBtn.addEventListener('click', () => {
      const isExpanded = skillsGrid.classList.toggle('expanded');
      if (isExpanded) {
        btnText.textContent = 'Show Less';
      } else {
        btnText.textContent = 'Show All';
      }
    });
  }

  // 10. Achievements & Badges Dynamic Row Wave Effect
  const setupBadgeWaveEffect = () => {
    const grid = document.querySelector('.badges-grid');
    if (!grid) return;
    
    const cards = Array.from(grid.querySelectorAll('.badge-card'));
    if (cards.length === 0) return;
    
    const resetAll = () => {
      cards.forEach(card => {
        card.style.removeProperty('--wave-lift');
        card.style.removeProperty('--wave-scale');
        card.style.removeProperty('--wave-rotate');
        card.style.removeProperty('--wave-shadow');
        card.style.removeProperty('--wave-title-color');
      });
    };
    
    cards.forEach(c => {
      c.addEventListener('mouseenter', () => {
        const offsetTop = c.offsetTop;
        
        // Find all cards in the same row
        const rowCards = cards.filter(card => Math.abs(card.offsetTop - offsetTop) < 10);
        const hoverIdx = rowCards.indexOf(c);
        
        // Reset cards in other rows
        cards.forEach(card => {
          if (!rowCards.includes(card)) {
            card.style.removeProperty('--wave-lift');
            card.style.removeProperty('--wave-scale');
            card.style.removeProperty('--wave-rotate');
            card.style.removeProperty('--wave-shadow');
            card.style.removeProperty('--wave-title-color');
          }
        });
        
        // Apply wave properties to the row cards
        rowCards.forEach((card, j) => {
          const dist = Math.abs(j - hoverIdx);
          
          let lift, scale, rotate, glowColor;
          if (dist === 0) {
            lift = '12px';
            scale = '1.1';
            rotate = '-3deg';
            glowColor = 'rgba(172, 129, 192, 0.45)';
            card.style.setProperty('--wave-title-color', 'var(--accent-color)');
          } else if (dist === 1) {
            lift = '8px';
            scale = '1.06';
            rotate = '-1.5deg';
            glowColor = 'rgba(172, 129, 192, 0.25)';
            card.style.setProperty('--wave-title-color', 'var(--accent-light)');
          } else if (dist === 2) {
            lift = '4px';
            scale = '1.03';
            rotate = '-0.5deg';
            glowColor = 'rgba(172, 129, 192, 0.15)';
            card.style.setProperty('--wave-title-color', 'var(--text-color)');
          } else {
            lift = '0px';
            scale = '1';
            rotate = '0deg';
            glowColor = 'rgba(0, 0, 0, 0.4)';
            card.style.setProperty('--wave-title-color', 'var(--text-color)');
          }
          
          card.style.setProperty('--wave-lift', lift);
          card.style.setProperty('--wave-scale', scale);
          card.style.setProperty('--wave-rotate', rotate);
          if (dist <= 2) {
            card.style.setProperty('--wave-shadow', `drop-shadow(0 8px 16px ${glowColor})`);
          } else {
            card.style.setProperty('--wave-shadow', `drop-shadow(0 4px 10px ${glowColor})`);
          }
        });
      });
    });
    
    grid.addEventListener('mouseleave', resetAll);
  };

  setupBadgeWaveEffect();
});
