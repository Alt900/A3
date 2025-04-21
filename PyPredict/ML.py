from . import torch,np,pd

    
def Window(df:pd.DataFrame,Variables:list,window_size:int=5)->np.array:
    Windowed_Set, Labels = [], []
    for i in range(len(df[Variables[0]])-window_size):
        Windowed_Set.append(df[Variables].iloc[i:i+window_size].values)
        Labels.append(df[Variables].iloc[i+window_size].values)
    return np.array(Windowed_Set,dtype=np.float32),np.array(Labels,dtype=np.float32)

def Split(Windows:np.array,Labels:np.array,ratio:tuple)->list:
    N = len(Windows)
    train_end = int(N*ratio[0])
    test_end = train_end + int(N*ratio[1])
    validation_end = test_end + int(N*ratio[2])

    window_train, label_train = Windows[:train_end],Labels[:train_end]
    window_test, label_test = Windows[train_end:test_end],Labels[train_end:test_end]
    window_validation, label_validation = Windows[test_end:validation_end],Labels[test_end:validation_end]

    return [(window_train,label_train),(window_test,label_test),(window_validation,label_validation)]


class Customized_Network(torch.nn.Module):
    def __init__(self,LayerArgs,Variables,BatchSize):
        self.LayerArgs = LayerArgs
        self.Variables = Variables
        self.BatchSize = BatchSize

        super().__init__()
        self.Layer_Dispatcher = {
            "LSTM Unidirectional": lambda Args : torch.nn.LSTM(
                input_size=Args[0],
                hidden_size=Args[1],
                num_layers=1,
                batch_first=True,
            ),
            "GRU": lambda Args: torch.nn.GRU(
                input_size=Args[0],
                hidden_size=Args[1],
                num_layers=1,
                batch_first=True
            ),
            "Dense":lambda Args: torch.nn.Linear(Args[0],Args[1]),
            "1D Convolution":lambda Args: torch.nn.Conv1d(
                in_channels=Args[0],
                out_channels=Args[1],
                kernel_size=Args[2],
                stride=Args[3],
                padding=Args[4]
            ),
            "1D Pooling": lambda Args: torch.nn.MaxPool1d(
                kernel_size=Args[0],
                stride=Args[1],
                padding=Args[2]
            ),
            "dropout":lambda p: torch.nn.Dropout(p),
            "Multi-Head Attention": lambda Args: torch.nn.MultiheadAttention(
                embed_dim=Args[0],
                num_heads=Args[1]
            )
        }

        self.Arg_Dispatcher={
            "LSTM Unidirectional":lambda I : [
                len(Variables) if I==0 else self.LayerArgs[I-1]['cell_count'],
                self.LayerArgs[I]["cell_count"]
            ],
            "GRU":lambda I : [
                len(Variables) if I==0 else self.LayerArgs[I-1]['cell_count'],
                self.LayerArgs[I]["cell_count"]
            ],
            "Dense":lambda I: [
                self.BatchSize if I==0 else self.LayerArgs[I-1]['cell_count'],
                self.LayerArgs[I]["cell_count"],
            ],
            "1D Convolution": lambda I: [
                len(Variables) if I==0 else self.LayerArgs[I-1]["cell_count"],
                self.LayerArgs[I]["filters"],
                self.LayerArgs[I]["kernel_size"],
                self.LayerArgs[I]["stride"],
                self.LayerArgs[I]["padding"]
            ],
            "1D Pooling": lambda I: [
                self.LayerArgs[I]["kernel_size"],
                self.LayerArgs[I]["stride"],
                self.LayerArgs[I]["padding"]
            ],
            "Multi-Head Attention": lambda I:[
                len(Variables) if I==0 else self.LayerArgs[I-1]['cell_count'],
                self.LayerArgs[I]["cell_count"]
            ]
        }

        self.Model_Architecture = []

        for Layer,Index in zip(self.LayerArgs,range(len(self.LayerArgs))):

            #base layer
            self.Model_Architecture.append(
                self.Layer_Dispatcher[Layer["layertype"]](
                    self.Arg_Dispatcher[Layer["layertype"]](Index)
                )
            )

            #dropout layer if applicable
            try: 
                if Layer["dropout"]>0.00:
                    self.Model_Architecture.append(self.Layer_Dispatcher["dropout"](Layer["dropout"]))
            except KeyError:#layer does not have dropout attribute 
                pass

            #activation layer
            if Layer["activation"]!="None":
                self.Model_Architecture.append(
                    eval(f"torch.nn.{Layer['activation']}()")
                )

        self.Model = torch.nn.Sequential(*self.Model_Architecture)
        
    def forward(self,x):
        out = x
        lstm_states = []
        N = len(self.Model_Architecture)
        for n in range(0,N):
            if isinstance(self.Model_Architecture[n],torch.nn.LSTM) or isinstance(self.Model_Architecture[n],torch.nn.GRU):
                out,h = self.Model_Architecture[n](out)
                lstm_states.append(h)
            elif isinstance(self.Model_Architecture[n],torch.nn.Conv1d) or isinstance(self.Model_Architecture[n],torch.nn.MaxPool1d):
                out = torch.permute(out,(0,2,1))
                out = self.Model_Architecture[n](out)#1D conv output shape reverts to batch_size,window_size,variables
            elif isinstance(self.Model_Architecture[n],torch.nn.MultiheadAttention):
                out = self.Model_Architecture[n](out,out,out)[0]#self-attention
                print(out.shape)
            else:#dense
                out = self.Model_Architecture[n](out)
        return out[:,-1,:],lstm_states#output prediction same

    
class Custom_Network_Model():
    def __init__(self,X,Y,batch_size,epochs,learning_rate,Optimizer,Loss,Model,SocketIO_Reference,Threading_Reference):
        self.Threading_Reference=Threading_Reference
        self.SocketIO_Reference=SocketIO_Reference
        
        self.batch_size = batch_size
        self.epochs = epochs
        self.learning_rate = learning_rate
        self.Model = Model
        self.Train_Loss = []
        self.Test_Loss = []
        self.Train_Accuracy = []
        self.Test_Accuracy = []

        self.train_x, self.train_y = torch.from_numpy(X[0]), torch.from_numpy(Y[0])
        self.test_x, self.test_y = torch.from_numpy(X[1]), torch.from_numpy(Y[1])

        self.TrainingLoader = torch.utils.data.DataLoader(
            torch.utils.data.TensorDataset(self.train_x,self.train_y),
            batch_size=batch_size,
            shuffle=True,
            drop_last=True
        )
        self.TestingLoader = torch.utils.data.DataLoader(
            torch.utils.data.TensorDataset(self.test_x,self.test_y),
            batch_size=batch_size,
            shuffle=True,
            drop_last=True
        )

        self.Optimizer = eval(f"torch.optim.{Optimizer}(self.Model.parameters(),lr={self.learning_rate})")
        self.LossFunction = eval(f"torch.nn.{Loss}()")

    def train(self):
        self.Threading_Reference.clear()
        for epoch in range(self.epochs):
            temptrain = None
            for X_train, Y_train in self.TrainingLoader:
                self.Optimizer.zero_grad()
                outputs,_ = self.Model(X_train)
                loss = self.LossFunction(outputs,Y_train)
                if loss=="nan":
                    print("Loss resulted in nan, something caused unstable gradients, stopping model traning.")
                    exit()
                loss.backward()
                self.Optimizer.step()
                temptrain = Y_train
            self.Train_Loss.append(float(loss))
            self.Train_Accuracy.append((torch.max(outputs,1==temptrain).sum().item())/temptrain.size(0))
            temptest = None
            for X_Test,Y_Test in self.TestingLoader:
                outputs,_ = self.Model(X_Test)
                loss = self.LossFunction(outputs,Y_Test)
                if loss=="nan":
                    print("Loss resulted in nan, something caused unstable gradients, stopping model traning.")
                    exit()
                loss.backward()
                self.Optimizer.step()
                temptest = Y_Test
            self.Test_Loss.append(float(loss))
            self.Test_Accuracy.append((torch.max(outputs,1==temptest).sum().item())/temptest.size(0))
            
            #relay progress back to Angular
            self.SocketIO_Reference.emit('TrainingIteration',{'epoch':epoch,'training_loss':self.Train_Loss[epoch],'testing_loss':self.Test_Loss[epoch]})
            print(f"epoch - {epoch}\nTraining loss: {self.Test_Loss[epoch]}\tTesting loss: {self.Test_Loss[epoch]}\n----------------------------------\nTraining accuracy: {self.Train_Accuracy[epoch]}\tTesting accuracy: {self.Test_Accuracy[epoch]}")
        self.Threading_Reference.set()

    def predict(self,x):
        predicted,_ = self.Model(torch.tensor(x))
        predicted = predicted.detach().numpy()
        return predicted