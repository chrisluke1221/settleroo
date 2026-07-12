# RoomTab - Split Bills at ease

A modern web application for managing shared expenses with roommates and friends. RoomTab makes it easy to track who owes what and settle up without the awkward conversations.

## 🌟 Features

### Core Functionality
- **Room Management**: Create and join rooms to organize shared expenses
- **Expense Tracking**: Add and categorize expenses with detailed descriptions
- **Smart Splitting**: Automatically calculate who owes what with intelligent splitting algorithms
- **Balance Tracking**: Real-time balance calculations for each member
- **Member Management**: Add and manage room members easily

### User Experience
- **Modern UI**: Beautiful, responsive design with smooth animations
- **Mobile Friendly**: Works perfectly on all devices
- **Real-time Updates**: Instant updates when expenses are added or modified
- **Intuitive Navigation**: Easy-to-use interface with clear navigation

### Technical Features
- **Progressive Web App**: Installable on mobile devices
- **Offline Support**: Works without internet connection
- **Local Storage**: Data persists between sessions
- **Performance Optimized**: Fast loading and smooth interactions

## 🚀 Getting Started

### Prerequisites
- Node.js (version 14 or higher)
- npm or yarn package manager

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/roomtab.git
   cd roomtab
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm start
   ```

4. **Open your browser**
   Navigate to `http://localhost:3000` to see the application

### Building for Production

1. **Create a production build**
   ```bash
   npm run build
   ```

2. **Serve the build**
   ```bash
   npm install -g serve
   serve -s build
   ```

## 📱 Usage Guide

### Creating a Room
1. Click "Create Room" from the dashboard
2. Enter a descriptive room name (e.g., "Apartment 3B", "Trip to Paris")
3. Add optional description
4. Add room members by name and email
5. Click "Create Room" to finish

### Adding Expenses
1. Navigate to your room
2. Click "Add Expense" button
3. Fill in the expense details:
   - Description (e.g., "Groceries", "Rent")
   - Amount
   - Who paid
   - Who to split with
4. Click "Add Expense" to save

### Managing Balances
- View current balances in the "Balances" tab
- Positive amounts show money owed to you
- Negative amounts show money you owe
- All calculations are automatic and real-time

### Joining Existing Rooms
1. Click "Join Room" from the dashboard
2. Enter the room code provided by the room creator
3. You'll be added to the room automatically

## 🛠️ Technology Stack

- **Frontend**: React 18 with Hooks
- **Styling**: Tailwind CSS with custom design system
- **Animations**: Framer Motion for smooth transitions
- **Icons**: Lucide React for consistent iconography
- **Routing**: React Router for navigation
- **State Management**: React Context API
- **Build Tool**: Create React App

## 📁 Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── Header.js       # Navigation header
│   └── Footer.js       # Site footer
├── contexts/           # React Context providers
│   ├── AuthContext.js  # User authentication state
│   └── RoomContext.js  # Room and expense management
├── pages/              # Main application pages
│   ├── Home.js         # Landing page
│   ├── Dashboard.js    # User dashboard
│   ├── Room.js         # Room management interface
│   ├── CreateRoom.js   # Room creation form
│   ├── JoinRoom.js     # Room joining interface
│   └── Login.js        # User authentication
├── App.js              # Main application component
├── index.js            # Application entry point
└── index.css           # Global styles and Tailwind imports
```

## 🎨 Design System

### Colors
- **Primary**: Blue gradient (#3B82F6 to #1D4ED8)
- **Secondary**: Gray scale (#64748B to #0F172A)
- **Success**: Green (#10B981)
- **Error**: Red (#EF4444)
- **Warning**: Yellow (#F59E0B)

### Typography
- **Font**: Inter (Google Fonts)
- **Weights**: 300, 400, 500, 600, 700
- **Sizes**: Responsive scale from 12px to 48px

### Components
- **Cards**: White background with subtle shadows
- **Buttons**: Primary and secondary variants with hover states
- **Inputs**: Consistent styling with focus states
- **Modals**: Overlay dialogs with smooth animations

## 🔧 Development

### Available Scripts

- `npm start` - Start development server
- `npm run build` - Create production build
- `npm test` - Run test suite
- `npm run eject` - Eject from Create React App
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint errors

### Code Style

This project uses:
- **ESLint** for code linting
- **Prettier** for code formatting
- **React Hooks** for state management
- **Functional Components** with hooks
- **Tailwind CSS** for styling

## 🚀 Deployment

### Netlify (Recommended)
1. Connect your GitHub repository to Netlify
2. Set build command: `npm run build`
3. Set publish directory: `build`
4. Deploy automatically on push to main branch

### Vercel
1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel` in project directory
3. Follow prompts to deploy

### Other Platforms
- **Firebase Hosting**: Use `firebase deploy`
- **AWS S3**: Upload build folder to S3 bucket
- **GitHub Pages**: Use `gh-pages` package

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and commit: `git commit -m 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Submit a pull request

### Development Guidelines
- Follow the existing code style
- Add tests for new features
- Update documentation as needed
- Ensure mobile responsiveness
- Test across different browsers

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **React Team** for the amazing framework
- **Tailwind CSS** for the utility-first CSS framework
- **Framer Motion** for smooth animations
- **Lucide** for beautiful icons
- **Create React App** for the development setup

## 📞 Support

- **Email**: support@roomtab.com
- **GitHub Issues**: [Create an issue](https://github.com/yourusername/roomtab/issues)
- **Documentation**: [View docs](https://roomtab.netlify.app/docs)

---

Made with ❤️ for roommates everywhere
