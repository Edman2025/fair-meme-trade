// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20CommissionLike {
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

contract CommissionVault {
    struct Withdrawal {
        address requester;
        address token;
        uint256 amount;
        bool approved;
        bool paid;
    }

    address public owner;
    mapping(address => bool) public admins;
    mapping(address => mapping(address => uint256)) public balances;
    uint256 public withdrawalCount;
    mapping(uint256 => Withdrawal) public withdrawals;

    event AdminUpdated(address indexed admin, bool enabled);
    event CommissionDeposited(address indexed wallet, address indexed token, uint256 amount, string source);
    event WithdrawalRequested(uint256 indexed withdrawalId, address indexed requester, address indexed token, uint256 amount);
    event WithdrawalReviewed(uint256 indexed withdrawalId, address indexed reviewer, bool approved);
    event WithdrawalPaid(uint256 indexed withdrawalId, address indexed requester, address indexed token, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "ONLY_OWNER");
        _;
    }

    modifier onlyAdmin() {
        require(msg.sender == owner || admins[msg.sender], "ONLY_ADMIN");
        _;
    }

    constructor(address initialAdmin) {
        owner = msg.sender;
        if (initialAdmin != address(0)) {
            admins[initialAdmin] = true;
            emit AdminUpdated(initialAdmin, true);
        }
    }

    function setAdmin(address admin, bool enabled) external onlyOwner {
        admins[admin] = enabled;
        emit AdminUpdated(admin, enabled);
    }

    function depositFor(address wallet, address token, uint256 amount, string calldata source) external {
        require(wallet != address(0), "WALLET_REQUIRED");
        require(token != address(0), "TOKEN_REQUIRED");
        require(amount > 0, "AMOUNT_REQUIRED");
        bool ok = IERC20CommissionLike(token).transferFrom(msg.sender, address(this), amount);
        require(ok, "TRANSFER_FAILED");
        balances[wallet][token] += amount;
        emit CommissionDeposited(wallet, token, amount, source);
    }

    function requestWithdrawal(address token, uint256 amount) external returns (uint256 withdrawalId) {
        require(balances[msg.sender][token] >= amount, "INSUFFICIENT_BALANCE");
        withdrawalId = ++withdrawalCount;
        withdrawals[withdrawalId] = Withdrawal({
            requester: msg.sender,
            token: token,
            amount: amount,
            approved: false,
            paid: false
        });
        emit WithdrawalRequested(withdrawalId, msg.sender, token, amount);
    }

    function reviewWithdrawal(uint256 withdrawalId, bool approved) external onlyAdmin {
        Withdrawal storage withdrawal = withdrawals[withdrawalId];
        require(withdrawal.requester != address(0), "NOT_FOUND");
        require(!withdrawal.paid, "PAID");
        withdrawal.approved = approved;
        emit WithdrawalReviewed(withdrawalId, msg.sender, approved);
    }

    function payWithdrawal(uint256 withdrawalId) external onlyAdmin {
        Withdrawal storage withdrawal = withdrawals[withdrawalId];
        require(withdrawal.approved, "NOT_APPROVED");
        require(!withdrawal.paid, "PAID");
        require(balances[withdrawal.requester][withdrawal.token] >= withdrawal.amount, "INSUFFICIENT_BALANCE");
        balances[withdrawal.requester][withdrawal.token] -= withdrawal.amount;
        withdrawal.paid = true;
        bool ok = IERC20CommissionLike(withdrawal.token).transfer(withdrawal.requester, withdrawal.amount);
        require(ok, "TRANSFER_FAILED");
        emit WithdrawalPaid(withdrawalId, withdrawal.requester, withdrawal.token, withdrawal.amount);
    }
}
