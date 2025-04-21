import * as THREE from "three";
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import {
    LayerHyperparametersInterface
  } from './GlobalStateManager';

export class Interactables_3D{

    //THREE variables
    static scene:THREE.Scene | null = null;
    static camera:THREE.PerspectiveCamera | null = null;
    static renderer:THREE.WebGLRenderer | null = null;
    static Raycaster:THREE.Raycaster = new THREE.Raycaster();
    static RaycasterMouseVector:THREE.Vector2 = new THREE.Vector2();
    static NetworkSpace:(THREE.Group | null)[] = [];
    static BoundingRects:(THREE.Mesh | null)[] = [];
    static GLTF_Loader:GLTFLoader = new GLTFLoader();
    static MouseVector:THREE.Vector2 = new THREE.Vector2();

    //event handler variables
    static MouseDown:boolean = false;
    static ActiveButton:number = 0;
    static Keys:{[key:string]:boolean}={"w":false,"a":false,"s":false,"d":false,"shift":false};
    static WASD_Speed:number = 0.5;
    static WASD_Boost:number = 5;
    static Quaternion:THREE.Quaternion = new THREE.Quaternion();

    //Materials
    static BasicMaterial:THREE.MeshBasicMaterial = new THREE.MeshBasicMaterial({color:0xa300cc,transparent:true,opacity:0.25});

    ///EVENT HANDLERS///

    private static onMouseUp():void{this.MouseDown=false;}

    private static onMouseDown(event: MouseEvent): void {
        if(event.button==0 && this.renderer && this.camera){
            const MouseCoordinates:THREE.Vector2 = new THREE.Vector2(
                (event.clientX/this.renderer.domElement.clientWidth)*2-1,
                -((event.clientY/this.renderer.domElement.clientHeight)*2-1)
            );
            this.Raycaster.setFromCamera(MouseCoordinates,this.camera);
            const ActiveRects:THREE.Mesh[] = this.BoundingRects.filter((item) => item!==null);
            const Intersection = this.Raycaster.intersectObjects(ActiveRects);
            const Hit = Intersection.find(Intersection => Intersection.object.name.split("_")[0] === "BoundingRect");
            if(Hit){
                const Index:number = parseInt(Hit.object.name.split("_")[1]);
                LayerHyperparametersInterface.SetSelectedLayer(Index);
            }
            this.MouseDown = true;
            this.ActiveButton = event.button;
        }
    }

    private static onMouseMove(event:MouseEvent):void{
        if(!this.MouseDown){return;}
        if(this.camera && this.renderer){
            if(this.ActiveButton===0){
                const QX:THREE.Quaternion = new THREE.Quaternion();
                const QY:THREE.Quaternion = new THREE.Quaternion();

                QX.setFromAxisAngle(new THREE.Vector3(1,0,0),-event.movementY*0.01);
                QY.setFromAxisAngle(new THREE.Vector3(0,1,0),-event.movementX*0.01);

                this.Quaternion.multiplyQuaternions(QY,this.Quaternion);
                this.Quaternion.multiplyQuaternions(this.Quaternion,QX);
                this.camera.quaternion.copy(this.Quaternion);
            }
        }
    }

    private static onKeyDown(event:KeyboardEvent):void{
        this.Keys[event.key.toLowerCase()]=true;
    }

    private static onKeyUp(event:KeyboardEvent):void{
        this.Keys[event.key.toLowerCase()]=false;
    }

    private static WASD_Movement():void{
        if(!this.camera || !this.MouseDown){return;}
        const Direction:THREE.Vector3 = new THREE.Vector3();
        const Right:THREE.Vector3 = new THREE.Vector3();
        this.camera.getWorldDirection(Direction);
        Direction.normalize();
        Right.crossVectors(new THREE.Vector3(0,1,0),Direction).normalize();

        if(this.Keys["w"]){
            this.camera.position.addScaledVector(Direction,this.Keys["shift"]?this.WASD_Speed*this.WASD_Boost:this.WASD_Speed);
        }
        if(this.Keys["a"]){
            this.camera.position.addScaledVector(Right,this.Keys["shift"]?this.WASD_Speed*this.WASD_Boost:this.WASD_Speed);

        }
        if(this.Keys["s"]){
            this.camera.position.addScaledVector(Direction,this.Keys["shift"]?-this.WASD_Speed*this.WASD_Boost:-this.WASD_Speed);
        }
        if(this.Keys["d"]){
            this.camera.position.addScaledVector(Right,this.Keys["shift"]?-this.WASD_Speed*this.WASD_Boost:-this.WASD_Speed);
        }
    }


    ///UTILITY FUNCTIONS AND INITIALIZATION///

    public static InitializeScene(H:number,W:number,ParentDiv:HTMLDivElement):void{
        this.scene = new THREE.Scene();
        this.scene.add(new THREE.GridHelper(100,100));
        this.scene.add(new THREE.AmbientLight(0xffffff,0.75));

        this.renderer = new THREE.WebGLRenderer();
        this.renderer.setSize(W,H);
        this.renderer.domElement.classList.add("3D_Canvas");

        this.renderer.domElement.addEventListener('mousedown',this.onMouseDown.bind(this));
        this.renderer.domElement.addEventListener('mousemove',this.onMouseMove.bind(this));
        this.renderer.domElement.addEventListener('mouseup',this.onMouseUp.bind(this));

        window.addEventListener("keydown",this.onKeyDown.bind(this));
        window.addEventListener("keyup",this.onKeyUp.bind(this));

        this.camera = new THREE.PerspectiveCamera(75,W/H,0.1,1000);
        this.camera.position.set(10,10,50);
        this.Raycaster.camera = this.camera;

        ParentDiv.appendChild(this.renderer.domElement);

        let Time:number = 0;
        const animate=(CurrentTime:number)=>{
            if(CurrentTime-Time>16){//cap FPS to 60
                if(this.renderer && this.camera && this.scene){
                    this.renderer.render(this.scene,this.camera);
                    this.WASD_Movement();
                }
                Time = CurrentTime;
            }
            requestAnimationFrame(animate);
        };
        animate(0);
    }

    public static RemoveLayer(Index:number):void{
        if(this.scene && this.NetworkSpace[Index]){
            const Group:THREE.Group = this.NetworkSpace[Index];
            Group.traverse(child => {
                if (child instanceof THREE.Mesh) {
                    if (child.geometry) child.geometry.dispose();
                    if (Array.isArray(child.material)) {
                      child.material.forEach((m) => m.dispose());
                    } else if (child.material) {
                      child.material.dispose();
                    }
                }
                this.scene?.remove(child);
            });
            this.scene.remove(Group);
            this.scene.remove(this.BoundingRects[Index] as THREE.Mesh);
        }
        this.NetworkSpace[Index] = null;
        this.BoundingRects[Index] = null;
    }

    private static CreateInstanceMesh(Mesh:THREE.Mesh,cell_count:number,X:number,Type:string):THREE.Group{
        if(!Mesh.geometry || !Mesh.material){
            console.error("Mesh does not have geoemtry or material");
        }

        const Scale:THREE.Vector3 = {
            "LSTM Unidirectional":new THREE.Vector3(10,5,1),
            "GRU":new THREE.Vector3(5,1,10),
            "Multi-Head Attention": new THREE.Vector3(3,1,6),
            "Dense": new THREE.Vector3(1,1,2)
        }[Type] as THREE.Vector3;

        const GlobalPosition:THREE.Vector3 = new THREE.Vector3(X,10,15);

        const Quaternion:THREE.Quaternion = {
            "LSTM Unidirectional":new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI/2,0,Math.PI)),
            "GRU":new  THREE.Quaternion().setFromEuler(new THREE.Euler(0,(3*Math.PI)/2,0)),
            "Multi-Head Attention":new THREE.Quaternion().setFromEuler(new THREE.Euler(0,(3*Math.PI)/2,0)),
            "Dense": new THREE.Quaternion().setFromEuler(new THREE.Euler(0,(3*Math.PI)/2,0))
        }[Type] as THREE.Quaternion;

        const Geometry:THREE.BufferGeometry<THREE.NormalBufferAttributes> = Mesh.geometry;
        let Material:THREE.MeshStandardMaterial = Mesh.material as THREE.MeshStandardMaterial;
        Material = Material.clone();
        const Matrix:THREE.Matrix4 = new THREE.Matrix4();

        const G:THREE.Group = new THREE.Group();
        const Instanced:THREE.InstancedMesh = new THREE.InstancedMesh(Geometry,Material,cell_count);
        Material = Material.clone();

        if(Material.map){
            Material.map.needsUpdate = true;
        }

        const BaseY:number = GlobalPosition.y;

        for(let I = 0; I<cell_count; I++){
            GlobalPosition.y = (I+1)*BaseY;
            Matrix.compose(GlobalPosition,Quaternion,Scale);
            Instanced.setMatrixAt(I,Matrix);
        }
        G.add(Instanced);
        return G;
    }

    public static ConstructPoolLayer(
        LayerArgs:number[],
        X:number,
        cell_count:number,
        Index:number
    ):void{
        const [K,S,D,P,F,Vars] = LayerArgs;
        const Lout:number = (Math.floor((Vars+2*P-D*(K-1)-1)/S)+1)*F;

        const Geometry:THREE.BoxGeometry = new THREE.BoxGeometry(3,3,3);
        const InstancedGroup:THREE.Group = new THREE.Group();
        const InputInstance:THREE.InstancedMesh = new THREE.InstancedMesh(Geometry,this.BasicMaterial,cell_count);
        const FeaturemapInstance:THREE.InstancedMesh = new THREE.InstancedMesh(Geometry,this.BasicMaterial,Lout);
        const Matrix:THREE.Matrix4 = new THREE.Matrix4();

        const MidX:number = X+1.6;
        const NextMidX:number = MidX+1.6;
        const NextX:number = X+5;

        for(let i=1; i<cell_count+1; i++){
            Matrix.setPosition(X,i*3.5,15);
            InputInstance.setMatrixAt(i-1,Matrix);
        }

        for (let i=1; i<Lout+1; i++){
            Matrix.setPosition(NextX,i*3.5,15);
            FeaturemapInstance.setMatrixAt(i-1,Matrix);
        }

        InstancedGroup.add(InputInstance);
        InstancedGroup.add(FeaturemapInstance);

        //draw kernel
        const KernelGeometry:THREE.BufferGeometry = new THREE.BufferGeometry();
        const VertexPositions:Float32Array = new Float32Array([
            MidX,2,16.5,//left input front bottom - 0 
            NextMidX,2,16.5, //right front bottom - 1
            MidX,2,13.5,//left input back bottom - 2
            NextMidX,2,13.5, //right bottom back - 3
            MidX,(K*4),13.5,//left input front top - 4
            NextMidX,5,16.5,//right top front - 5
            MidX,(K*4),16.5,//left input back top - 6
            NextMidX,5,13.5//right top back - 7
        ]);

        const FaceIndicies:number[] = [
            0, 1, 4,
            1, 5, 4,
            2, 6, 3,
            3, 6, 7,
            0, 4, 2,
            2, 4, 6,
            1, 3, 5,
            3, 7, 5,
            4, 5, 6,
            5, 7, 6,
            0, 2, 1,
            1, 2, 3,
        ];
        KernelGeometry.setAttribute('position',new THREE.BufferAttribute(VertexPositions,3));
        KernelGeometry.setIndex(FaceIndicies);
        const KernelInstance:THREE.Mesh = new THREE.Mesh(KernelGeometry,this.BasicMaterial);
        
        InstancedGroup.add(KernelInstance);

        const BoundingGeometry:THREE.BoxGeometry = new THREE.BoxGeometry(25,10*cell_count,30);
        const BoundingMesh:THREE.Mesh = new THREE.Mesh(BoundingGeometry,new THREE.MeshBasicMaterial({color:0x000000,wireframe:true}));
        BoundingMesh.position.set(X,5.5*cell_count,15);
        BoundingMesh.name = `BoundingRect_${Index}`;
        InstancedGroup.add(BoundingMesh);

        if(this.scene){
            this.scene.add(InstancedGroup);
            if(Index > this.NetworkSpace.length){
                this.NetworkSpace.push(InstancedGroup);
                this.BoundingRects.push(BoundingMesh);
            } else{
                this.NetworkSpace[Index] = InstancedGroup;
                this.BoundingRects[Index] = BoundingMesh;
            }
        }
    }

    public static ReRenderLayer(
        LayerArgs:number[]|null,
        cell_count:number,
        Index:number,
        Type:string
    ):void{
        const X:number = Index*25;
        this.RemoveLayer(Index);
        if(LayerArgs!==null){
            this.ConstructPoolLayer(LayerArgs,X,cell_count,Index);
        } else {
            this.ConstructStaticLayer(cell_count,X,Type,Index);
        }
    }

    public static ConstructStaticLayer(
        cell_count:number,
        X:number,
        Type:string,
        Index:number,
    ):void{
        if(this.scene){
            const File:string = {
                "LSTM Unidirectional":"3D_Assets/LSTM.glb",
                "Multi-Head Attention":"3D_Assets/MHA.glb",
                "GRU":"3D_Assets/GRU.glb",
                "Dense":"3D_Assets/Dense.glb"
            }[Type] as string;
            this.GLTF_Loader.load(
                File,
                (glft)=>{
                    const Model:THREE.Group<THREE.Object3DEventMap> = glft.scene;
                    const TransferedGroup:THREE.Group = new THREE.Group();
                    let i=0;
                    if (Model instanceof THREE.Group){
                        Model.traverse((Child)=>{
                            if(Child instanceof THREE.Mesh){
                                const SubGroup:THREE.Group = this.CreateInstanceMesh(Child,cell_count,X,Type);
                                i+=1;
                                TransferedGroup.add(SubGroup);
                            }
                        });
                        const BoundingGeometry:THREE.BoxGeometry = new THREE.BoxGeometry(25,10*cell_count,30);
                        const BoundingMesh:THREE.Mesh = new THREE.Mesh(BoundingGeometry,new THREE.MeshBasicMaterial({color:0x000000,wireframe:true}));
                        BoundingMesh.position.set(X,5.5*cell_count,15);
                        BoundingMesh.name = `BoundingRect_${Index}`;
                        TransferedGroup.add(BoundingMesh);
                        if(Index > this.NetworkSpace.length){
                            this.NetworkSpace.push(TransferedGroup);
                            this.BoundingRects.push(BoundingMesh);
                        } else{
                            this.NetworkSpace[Index] = TransferedGroup;
                            this.BoundingRects[Index] = BoundingMesh;
                        }
                        this.scene?.add(TransferedGroup);
                    }
                }
            );
        }
    }
}