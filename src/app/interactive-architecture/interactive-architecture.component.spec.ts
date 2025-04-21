import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InteractiveArchitectureComponent } from './interactive-architecture.component';

describe('InteractiveArchitectureComponent', () => {
  let component: InteractiveArchitectureComponent;
  let fixture: ComponentFixture<InteractiveArchitectureComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InteractiveArchitectureComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InteractiveArchitectureComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
